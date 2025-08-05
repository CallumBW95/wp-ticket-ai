// Test the ticket service functions directly
const API_BASE_URL = "http://localhost:3001";

async function testGetTicketDetails(ticketId) {
  try {
    console.log(`Testing getTicketDetails for ticket ${ticketId}:`);
    const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log("  ❌ Ticket not found");
        return null;
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const ticket = await response.json();
    console.log(`  ✅ Found: ${ticket.title}`);
    return ticket;
  } catch (error) {
    console.error("  ❌ Error:", error.message);
    return null;
  }
}

async function testSearchTickets(query) {
  try {
    console.log(`Testing searchTickets for query "${query}":`);
    const response = await fetch(`${API_BASE_URL}/api/tickets/search/${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`  ✅ Found ${result.tickets.length} tickets`);
    if (result.tickets.length > 0) {
      console.log(`  First result: ${result.tickets[0].title}`);
    }
    return result.tickets;
  } catch (error) {
    console.error("  ❌ Error:", error.message);
    return [];
  }
}

async function main() {
  // Test specific ticket IDs
  await testGetTicketDetails(63787);
  await testGetTicketDetails(63778);
  await testGetTicketDetails(99999); // Should not exist
  
  console.log("\n");
  
  // Test search functionality
  await testSearchTickets("SVG");
  await testSearchTickets("Gutenberg");
}

main();