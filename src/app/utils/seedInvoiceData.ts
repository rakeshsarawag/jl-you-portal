/**
 * Invoice System Seed Data
 * Creates sample Bill To, Registration, and Remittance data for testing
 */

import { projectId, publicAnonKey } from '../utils/constants';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/invoices`;

export async function seedInvoiceData() {
  try {
    console.log('Starting invoice data seeding...');

    // Sample Bill To entries
    const billToData = [
      {
        id: 'billto_001',
        client: 'WBG',
        name: 'WorldBank Group',
        address: `1818 H Street, NW\nWashington, DC 20433\nUnited States`,
        gstin: '',
      },
      {
        id: 'billto_002',
        client: 'Acme Corp',
        name: 'Acme Corporation Pvt Ltd',
        address: `Plot No. 123, Sector 5\nGurgaon, Haryana - 122001\nIndia`,
        gstin: '07AABCU9603R1ZM',
      },
      {
        id: 'billto_003',
        client: 'Tech Solutions',
        name: 'Tech Solutions Inc',
        address: `500 7th Avenue\nNew York, NY 10018\nUnited States`,
        gstin: '',
      },
    ];

    // Sample Registration entries
    const registrationData = [
      {
        id: 'reg_001',
        name: 'Jeshan Labs Private Limited',
        details: `Jeshan Labs Private Limited
Plot No. 456, IT Park
Bangalore, Karnataka - 560001, India

CIN: U72900KA2020PTC123456
GSTIN: 29AABCJ1234F1Z5
PAN: AABCJ1234F
Email: accounts@jeshanlabs.com
Phone: +91 80 1234 5678`,
      },
    ];

    // Sample Remittance entries
    const remittanceData = [
      {
        id: 'rem_001',
        name: 'INR Bank Account',
        currency: 'INR',
        isDefault: true,
        details: `Bank Name: State Bank of India
Account Name: Jeshan Labs Private Limited
Account Number: 1234567890
IFSC Code: SBIN0001234
Branch: Koramangala, Bangalore
Swift Code: SBININBB123`,
      },
      {
        id: 'rem_002',
        name: 'USD Bank Account',
        currency: 'USD',
        isDefault: true,
        details: `Bank Name: Citibank N.A.
Account Name: Jeshan Labs Private Limited
Account Number: US1234567890
SWIFT Code: CITIUS33XXX
Routing Number: 021000089
Bank Address: New York, NY, USA`,
      },
      {
        id: 'rem_003',
        name: 'EUR Bank Account',
        currency: 'EUR',
        isDefault: true,
        details: `Bank Name: Deutsche Bank AG
Account Name: Jeshan Labs Private Limited
IBAN: DE89370400440532013000
SWIFT Code: DEUTDEFF
Bank Address: Frankfurt, Germany`,
      },
    ];

    // Seed Bill To data
    for (const item of billToData) {
      try {
        await fetch(`${API_BASE}/billto`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': 'admin',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item),
        });
        console.log(`✓ Created Bill To: ${item.client}`);
      } catch (error) {
        console.error(`✗ Failed to create Bill To: ${item.client}`, error);
      }
    }

    // Seed Registration data
    for (const item of registrationData) {
      try {
        await fetch(`${API_BASE}/registration`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': 'admin',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item),
        });
        console.log(`✓ Created Registration: ${item.name}`);
      } catch (error) {
        console.error(`✗ Failed to create Registration: ${item.name}`, error);
      }
    }

    // Seed Remittance data
    for (const item of remittanceData) {
      try {
        await fetch(`${API_BASE}/remittance`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': 'admin',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item),
        });
        console.log(`✓ Created Remittance: ${item.name} (${item.currency})`);
      } catch (error) {
        console.error(`✗ Failed to create Remittance: ${item.name}`, error);
      }
    }

    console.log('✓ Invoice data seeding completed!');
    return true;
  } catch (error) {
    console.error('Error seeding invoice data:', error);
    return false;
  }
}
