// Test frontend ticket service functions
import fetch from 'node-fetch';

const API_BASE_URL = "http://localhost:3001";

async function testTicketService() {
  console.log("Testing Frontend Ticket Service Functions:\n");
  
  // Test getTicketDetails function (simulating frontend behavior)
  console.log("1. Testing getTicketDetails:");
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/63778`);
    if (!response.ok) {
      if (response.status === 404) {
        console.log("  ❌ Ticket not found");
      } else {
        throw new Error(`API request failed: ${response.status}`);
      }
    } else {
      const ticket = await response.json();
      console.log(`  ✅ Found: ${ticket.title}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Test searchTickets function
  console.log("\n2. Testing searchTickets:");
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/search/SVG`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const result = await response.json();
    console.log(`  ✅ Found ${result.tickets.length} tickets`);
    if (result.tickets.length > 0) {
      console.log(`  First result: ${result.tickets[0].title}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Test getRecentTickets function
  console.log("\n3. Testing getRecentTickets:");
  try {
    const response = await fetch(`${API_BASE_URL}/api/tickets/recent`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const result = await response.json();
    console.log(`  ✅ Found ${result.tickets.length} recent tickets`);
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

testTicketService();