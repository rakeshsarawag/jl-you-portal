import { toast } from 'sonner';

// Workflow Types
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';
export type NodeType = 'trigger' | 'condition' | 'action' | 'approval' | 'notification' | 'delay' | 'end' | 'parallel' | 'create_record' | 'update_field' | 'email' | 'webhook' | 'loop' | 'audit_log';
export type TriggerType = 'manual' | 'scheduled' | 'event' | 'form_submission' | 'status_change';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: any;
  position: { x: number; y: number };
  connections: string[]; // IDs of connected nodes
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  trigger: {
    type: TriggerType;
    config: any;
  };
  nodes: WorkflowNode[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  currentNodeId: string | null;
  data: any;
  startedAt: string;
  completedAt?: string;
  history: WorkflowHistoryEntry[];
}

export interface WorkflowHistoryEntry {
  nodeId: string;
  nodeName: string;
  action: string;
  status: 'success' | 'error' | 'pending';
  timestamp: string;
  data?: any;
  error?: string;
}

export interface ApprovalRequest {
  id: string;
  workflowInstanceId: string;
  nodeId: string;
  requestedBy: string;
  approvers: string[];
  currentApproverIndex: number;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  data: any;
  createdAt: string;
  responses: ApprovalResponse[];
}

export interface ApprovalResponse {
  approver: string;
  status: 'approved' | 'rejected';
  comment: string;
  timestamp: string;
}

export class WorkflowEngine {
  private static workflows: Map<string, WorkflowDefinition> = new Map();
  private static instances: Map<string, WorkflowInstance> = new Map();
  private static approvals: Map<string, ApprovalRequest> = new Map();

  /**
   * Create a new workflow definition
   */
  static createWorkflow(workflow: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>): WorkflowDefinition {
    const id = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newWorkflow: WorkflowDefinition = {
      ...workflow,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    this.workflows.set(id, newWorkflow);
    this.saveToStorage();
    return newWorkflow;
  }

  /**
   * Update an existing workflow
   */
  static updateWorkflow(id: string, updates: Partial<WorkflowDefinition>): WorkflowDefinition | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const updated = {
      ...workflow,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: workflow.version + 1
    };

    this.workflows.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Get all workflows
   */
  static getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow by ID
   */
  static getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  /**
   * Delete a workflow
   */
  static deleteWorkflow(id: string): boolean {
    const deleted = this.workflows.delete(id);
    if (deleted) this.saveToStorage();
    return deleted;
  }

  /**
   * Start a workflow instance
   */
  static async startWorkflow(workflowId: string, initialData: any = {}): Promise<WorkflowInstance | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      console.error('Workflow not found:', workflowId);
      return null;
    }

    if (workflow.status !== 'active') {
      console.error('Workflow is not active:', workflow.status);
      toast.error('Cannot start inactive workflow');
      return null;
    }

    const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const instance: WorkflowInstance = {
      id: instanceId,
      workflowId,
      status: 'running',
      currentNodeId: null,
      data: initialData,
      startedAt: new Date().toISOString(),
      history: []
    };

    this.instances.set(instanceId, instance);
    
    // Find the first node (trigger node)
    const firstNode = workflow.nodes.find(n => n.type === 'trigger');
    if (firstNode) {
      await this.executeNode(instance, workflow, firstNode);
    }

    this.saveToStorage();
    return instance;
  }

  /**
   * Execute a workflow node
   */
  private static async executeNode(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    node: WorkflowNode
  ): Promise<void> {
    instance.currentNodeId = node.id;

    const historyEntry: WorkflowHistoryEntry = {
      nodeId: node.id,
      nodeName: node.label,
      action: node.type,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    try {
      switch (node.type) {
        case 'trigger':
          historyEntry.action = 'Workflow Started';
          historyEntry.status = 'success';
          break;

        case 'action':
          await this.executeAction(instance, node);
          historyEntry.status = 'success';
          historyEntry.action = `Action: ${node.config.actionType || 'Unknown'}`;
          break;

        case 'condition':
          const conditionResult = this.evaluateCondition(instance, node);
          historyEntry.status = 'success';
          historyEntry.action = `Condition: ${conditionResult ? 'True' : 'False'}`;
          historyEntry.data = { result: conditionResult };
          break;

        case 'approval':
          await this.requestApproval(instance, node);
          instance.status = 'waiting_approval';
          historyEntry.status = 'pending';
          historyEntry.action = 'Approval Requested';
          instance.history.push(historyEntry);
          this.saveToStorage();
          return; // Stop execution until approved

        case 'notification':
          await this.sendNotification(instance, node);
          historyEntry.status = 'success';
          historyEntry.action = `Notification Sent: ${node.config.message}`;
          break;

        case 'delay':
          historyEntry.status = 'success';
          historyEntry.action = `Delayed: ${node.config.duration} ${node.config.unit}`;
          break;

        case 'end':
          instance.status = 'completed';
          instance.completedAt = new Date().toISOString();
          historyEntry.status = 'success';
          historyEntry.action = 'Workflow Completed';
          break;
      }

      instance.history.push(historyEntry);

      // Move to next node
      if (node.type !== 'end' && node.connections.length > 0) {
        const nextNodeId = node.connections[0];
        const nextNode = workflow.nodes.find(n => n.id === nextNodeId);
        if (nextNode) {
          await this.executeNode(instance, workflow, nextNode);
        }
      } else if (node.type !== 'end') {
        // No more nodes, complete workflow
        instance.status = 'completed';
        instance.completedAt = new Date().toISOString();
      }

      this.saveToStorage();
    } catch (error) {
      console.error('Error executing node:', error);
      historyEntry.status = 'error';
      historyEntry.error = error instanceof Error ? error.message : 'Unknown error';
      instance.history.push(historyEntry);
      instance.status = 'failed';
      this.saveToStorage();
    }
  }

  /**
   * Execute an action node
   */
  private static async executeAction(instance: WorkflowInstance, node: WorkflowNode): Promise<void> {
    const { actionType, config } = node.config;

    switch (actionType) {
      case 'update_status':
        instance.data.status = config.newStatus;
        break;
      case 'send_email':
        // Email would be sent here
        console.log('Sending email:', config);
        break;
      case 'create_record':
        console.log('Creating record:', config);
        break;
      case 'update_field':
        if (config.field && config.value !== undefined) {
          instance.data[config.field] = config.value;
        }
        break;
      default:
        console.log('Unknown action type:', actionType);
    }
  }

  /**
   * Evaluate a condition node
   */
  private static evaluateCondition(instance: WorkflowInstance, node: WorkflowNode): boolean {
    const { field, operator, value } = node.config;
    const fieldValue = instance.data[field];

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'greaterThan':
        return Number(fieldValue) > Number(value);
      case 'lessThan':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'isEmpty':
        return !fieldValue;
      case 'isNotEmpty':
        return !!fieldValue;
      default:
        return false;
    }
  }

  /**
   * Request approval
   */
  private static async requestApproval(instance: WorkflowInstance, node: WorkflowNode): Promise<void> {
    const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const approval: ApprovalRequest = {
      id: approvalId,
      workflowInstanceId: instance.id,
      nodeId: node.id,
      requestedBy: instance.data.requestedBy || 'System',
      approvers: node.config.approvers || [],
      currentApproverIndex: 0,
      status: 'pending',
      message: node.config.message || 'Approval required',
      data: instance.data,
      createdAt: new Date().toISOString(),
      responses: []
    };

    this.approvals.set(approvalId, approval);
    this.saveToStorage();

    toast.info(`Approval request sent to ${approval.approvers[0]}`);
  }

  /**
   * Process approval response
   */
  static async processApproval(
    approvalId: string,
    approver: string,
    status: 'approved' | 'rejected',
    comment: string = ''
  ): Promise<void> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      toast.error('Approval request not found');
      return;
    }

    const response: ApprovalResponse = {
      approver,
      status,
      comment,
      timestamp: new Date().toISOString()
    };

    approval.responses.push(response);

    if (status === 'rejected') {
      approval.status = 'rejected';
      const instance = this.instances.get(approval.workflowInstanceId);
      if (instance) {
        instance.status = 'failed';
        instance.history.push({
          nodeId: approval.nodeId,
          nodeName: 'Approval',
          action: 'Approval Rejected',
          status: 'error',
          timestamp: new Date().toISOString(),
          data: { approver, comment }
        });
      }
      toast.error('Workflow rejected');
    } else {
      // Check if more approvers needed
      approval.currentApproverIndex++;
      if (approval.currentApproverIndex >= approval.approvers.length) {
        // All approvals received
        approval.status = 'approved';
        const instance = this.instances.get(approval.workflowInstanceId);
        if (instance) {
          instance.status = 'running';
          instance.history.push({
            nodeId: approval.nodeId,
            nodeName: 'Approval',
            action: 'Approval Granted',
            status: 'success',
            timestamp: new Date().toISOString(),
            data: { approvers: approval.responses }
          });

          // Continue workflow execution
          const workflow = this.workflows.get(instance.workflowId);
          if (workflow) {
            const currentNode = workflow.nodes.find(n => n.id === approval.nodeId);
            if (currentNode && currentNode.connections.length > 0) {
              const nextNodeId = currentNode.connections[0];
              const nextNode = workflow.nodes.find(n => n.id === nextNodeId);
              if (nextNode) {
                await this.executeNode(instance, workflow, nextNode);
              }
            }
          }
        }
        toast.success('Workflow approved and continuing');
      } else {
        toast.info(`Approval received. Waiting for ${approval.approvers[approval.currentApproverIndex]}`);
      }
    }

    this.saveToStorage();
  }

  /**
   * Send notification
   */
  private static async sendNotification(instance: WorkflowInstance, node: WorkflowNode): Promise<void> {
    const { recipients, message, channel } = node.config;
    
    // In a real app, this would send actual notifications
    console.log('Sending notification:', { recipients, message, channel });
    
    if (channel === 'toast') {
      toast.info(message);
    }
  }

  /**
   * Get all workflow instances
   */
  static getAllInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get pending approvals
   */
  static getPendingApprovals(approver?: string): ApprovalRequest[] {
    const approvals = Array.from(this.approvals.values()).filter(a => a.status === 'pending');
    
    if (approver) {
      return approvals.filter(a => 
        a.approvers[a.currentApproverIndex] === approver
      );
    }
    
    return approvals;
  }

  /**
   * Cancel workflow instance
   */
  static cancelWorkflow(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    instance.status = 'cancelled';
    instance.completedAt = new Date().toISOString();
    instance.history.push({
      nodeId: instance.currentNodeId || '',
      nodeName: 'System',
      action: 'Workflow Cancelled',
      status: 'error',
      timestamp: new Date().toISOString()
    });

    this.saveToStorage();
    return true;
  }

  /**
   * Get workflow statistics
   */
  static getStatistics() {
    const instances = Array.from(this.instances.values());
    const workflows = Array.from(this.workflows.values());

    return {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter(w => w.status === 'active').length,
      totalInstances: instances.length,
      runningInstances: instances.filter(i => i.status === 'running').length,
      completedInstances: instances.filter(i => i.status === 'completed').length,
      failedInstances: instances.filter(i => i.status === 'failed').length,
      pendingApprovals: this.getPendingApprovals().length
    };
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('workflows', JSON.stringify(Array.from(this.workflows.entries())));
      localStorage.setItem('workflow_instances', JSON.stringify(Array.from(this.instances.entries())));
      localStorage.setItem('workflow_approvals', JSON.stringify(Array.from(this.approvals.entries())));
    } catch (error) {
      console.error('Error saving workflows:', error);
    }
  }

  /**
   * Load from localStorage
   */
  static loadFromStorage(): void {
    try {
      const workflowsData = localStorage.getItem('workflows');
      if (workflowsData) {
        this.workflows = new Map(JSON.parse(workflowsData));
      }

      const instancesData = localStorage.getItem('workflow_instances');
      if (instancesData) {
        this.instances = new Map(JSON.parse(instancesData));
      }

      const approvalsData = localStorage.getItem('workflow_approvals');
      if (approvalsData) {
        this.approvals = new Map(JSON.parse(approvalsData));
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
    }
  }
}

// Load data on initialization
WorkflowEngine.loadFromStorage();
