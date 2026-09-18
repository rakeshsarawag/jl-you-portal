import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ==================== ASSETS ====================

app.get('/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('assets')
      .select('*, asset_assignments(employee_id, employee_name, assigned_date, returned_date)')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch assets' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('assets')
      .select('*, asset_assignments(*), asset_maintenance(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'Asset not found' }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch asset' }, 500);
  }
});

app.post('/create', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('assets')
      .insert([{
        asset_tag: body.assetTag || `AST-${Date.now()}`,
        name: body.name,
        type: body.type || '',
        category: body.category || '',
        serial_number: body.serialNumber || '',
        purchase_date: body.purchaseDate || null,
        purchase_cost: body.purchaseCost || body.purchasePrice || null,
        vendor: body.vendor || '',
        warranty_expiry: body.warrantyExpiry || null,
        status: body.status || 'Available',
        condition: body.condition || 'Good',
        location: body.location || '',
        notes: body.notes || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create asset' }, 500);
  }
});

app.put('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('assets')
      .update({
        name: body.name,
        type: body.type,
        category: body.category,
        serial_number: body.serialNumber,
        purchase_date: body.purchaseDate,
        purchase_cost: body.purchaseCost || body.purchasePrice,
        vendor: body.vendor,
        warranty_expiry: body.warrantyExpiry,
        status: body.status,
        condition: body.condition,
        location: body.location,
        notes: body.notes,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update asset' }, 500);
  }
});

app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('assets').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete asset' }, 500);
  }
});

// ==================== ASSIGN / RETURN ====================

app.post('/assign', async (c) => {
  try {
    const supabase = getSupabase();
    const { assetId, employeeId, employeeName } = await c.req.json();

    // Update asset status
    await supabase
      .from('assets')
      .update({
        status: 'Assigned',
        current_employee_id: employeeId || null,
        current_employee_name: employeeName || '',
        assigned_date: new Date().toISOString().split('T')[0],
        ...auditUpdate(c),
      })
      .eq('id', assetId);

    // Record assignment history
    const { data, error } = await supabase
      .from('asset_assignments')
      .insert([{
        asset_id: assetId,
        employee_id: employeeId || null,
        employee_name: employeeName || '',
        assigned_date: new Date().toISOString().split('T')[0],
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Fetch the updated asset to return it
    const { data: updatedAsset } = await supabase.from('assets').select('*').eq('id', assetId).single();

    // Check if employee is in onboarding (joined within last 90 days)
    if (employeeId) {
      try {
        const { data: assetData } = await supabase
          .from('assets')
          .select('name')
          .eq('id', assetId)
          .single();
        const assetName = assetData?.name || 'Asset';

        const { data: emp } = await supabase
          .from('employees')
          .select('joining_date, name, id')
          .eq('id', employeeId)
          .single();

        if (emp) {
          const daysSinceJoining = Math.floor((Date.now() - new Date(emp.joining_date).getTime()) / 86400000);
          if (daysSinceJoining <= 90) {
            await supabase
              .from('onboarding_tasks')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('employee_id', employeeId)
              .ilike('title', '%asset%');

            await supabase.from('notifications').insert({
              user_id: employeeId,
              title: 'Asset Assigned',
              message: `${assetName} has been assigned to you as part of your onboarding kit.`,
              type: 'onboarding',
              link: '/onboarding',
              ...auditCreate(c),
            });
          }
        }
      } catch {}
    }

    return c.json({ success: true, data: updatedAsset ?? data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to assign asset' }, 500);
  }
});

app.post('/return', async (c) => {
  try {
    const supabase = getSupabase();
    const { assetId, condition } = await c.req.json();

    // Update asset
    await supabase
      .from('assets')
      .update({
        status: 'Available',
        current_employee_id: null,
        current_employee_name: null,
        assigned_date: null,
        condition: condition || 'Good',
        ...auditUpdate(c),
      })
      .eq('id', assetId);

    // Close open assignment
    const { data: openAssignment } = await supabase
      .from('asset_assignments')
      .select('id')
      .eq('asset_id', assetId)
      .is('returned_date', null)
      .maybeSingle();

    if (openAssignment) {
      await supabase
        .from('asset_assignments')
        .update({ returned_date: new Date().toISOString().split('T')[0], condition_at_return: condition || 'Good', ...auditUpdate(c) })
        .eq('id', openAssignment.id);
    }

    const { data: returnedAsset } = await supabase.from('assets').select('*').eq('id', assetId).single();
    return c.json({ success: true, data: returnedAsset });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to return asset' }, 500);
  }
});

// ==================== MAINTENANCE ====================

app.post('/:id/maintenance', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('asset_maintenance')
      .insert([{
        asset_id: c.req.param('id'),
        type: body.type || 'Preventive',
        maintenance_date: body.date || new Date().toISOString().split('T')[0],
        cost: body.cost || null,
        performed_by: body.performedBy || '',
        description: body.description || '',
        next_due_date: body.nextDueDate || null,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to log maintenance' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('assets').select('status, category');

    const total = data?.length || 0;
    const available = data?.filter((a: any) => a.status === 'Available').length || 0;
    const assigned = data?.filter((a: any) => a.status === 'Assigned').length || 0;
    const inRepair = data?.filter((a: any) => a.status === 'In Repair').length || 0;

    return c.json({ success: true, data: { total, assigned, maintenance: inRepair, totalAssets: total, availableAssets: available, assignedAssets: assigned, inRepairAssets: inRepair } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// ==================== DOCUMENTS ====================

function isTableMissing(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

app.get('/documents/:assetId', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('asset_documents')
      .select('*')
      .eq('asset_id', c.req.param('assetId'))
      .order('uploaded_at', { ascending: false });

    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch documents' }, 500);
  }
});

app.post('/documents', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('asset_documents')
      .insert([{
        asset_id: body.assetId,
        filename: body.filename,
        file_type: body.fileType || 'other',
        file_size_kb: body.fileSizeKB || 0,
        notes: body.notes || '',
        uploaded_by: body.uploadedBy || '',
      }])
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true, data: { id: crypto.randomUUID(), asset_id: body.assetId, filename: body.filename, file_type: body.fileType || 'other', file_size_kb: body.fileSizeKB || 0, notes: body.notes || '', uploaded_by: body.uploadedBy || '', uploaded_at: new Date().toISOString() } }, 201);
      }
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create document' }, 500);
  }
});

app.delete('/documents/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('asset_documents').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete document' }, 500);
  }
});

export default app;
