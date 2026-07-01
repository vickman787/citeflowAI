async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/debug-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'What are the latest advancements in zero-knowledge proofs?', maxBudget: 0.50 })
    });
    
    if (!res.ok) {
      console.log('HTTP ERROR:', res.status, await res.text());
      return;
    }
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      console.log('CHUNK:', decoder.decode(value));
    }
  } catch(e) {
    console.error(e);
  }
}

test();
