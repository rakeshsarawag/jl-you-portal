import React, { useState } from 'react';
import { projectId, publicAnonKey } from '../utils/constants';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

export function APIConnectionTest() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    setTesting(true);
    const results: any[] = [];

    // Test 1: Ping endpoint
    try {
      console.log('Testing ping endpoint...');
      const response = await fetch(`${SERVER_URL}/ping`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      const data = await response.json();
      results.push({
        test: 'Ping',
        status: response.status,
        success: response.ok,
        data,
      });
    } catch (error: any) {
      results.push({
        test: 'Ping',
        status: 'ERROR',
        success: false,
        error: error.message,
      });
    }

    // Test 2: Get employees
    try {
      console.log('Testing employees endpoint...');
      const response = await fetch(`${SERVER_URL}/employees/all`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      results.push({
        test: 'Get Employees',
        status: response.status,
        success: response.ok,
        data: Array.isArray(data) ? `${data.length} employees` : data,
      });
    } catch (error: any) {
      results.push({
        test: 'Get Employees',
        status: 'ERROR',
        success: false,
        error: error.message,
      });
    }

    // Test 3: Get candidates ready for onboarding
    try {
      console.log('Testing candidates endpoint...');
      const response = await fetch(`${SERVER_URL}/recruitment/candidates/ready-for-onboarding`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      results.push({
        test: 'Get Candidates Ready for Onboarding',
        status: response.status,
        success: response.ok,
        data: data?.data ? `${data.data.length} candidates` : data,
      });
    } catch (error: any) {
      results.push({
        test: 'Get Candidates Ready for Onboarding',
        status: 'ERROR',
        success: false,
        error: error.message,
      });
    }

    setTestResults(results);
    setTesting(false);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 max-w-md z-50">
      <h3 className="font-bold text-lg mb-2">API Connection Test</h3>
      <div className="text-xs mb-2 text-gray-600">
        <div>Server: {SERVER_URL}</div>
        <div>Project ID: {projectId}</div>
      </div>
      
      <button
        onClick={runTests}
        disabled={testing}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 mb-3"
      >
        {testing ? 'Testing...' : 'Run Connection Tests'}
      </button>

      {testResults.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-2 rounded text-sm ${
                result.success ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <div className="font-semibold">{result.test}</div>
              <div className="text-xs">
                Status: {result.status}
                {result.success && result.data && (
                  <div>Response: {JSON.stringify(result.data).substring(0, 100)}</div>
                )}
                {!result.success && result.error && (
                  <div className="text-red-700">Error: {result.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
