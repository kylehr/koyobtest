async function t() {
  do {
      console.log(`test log ${new Date()}`);
      await new Promise(resolve => setTimeout(resolve, 20000)); 
    } while (true);
  }
t()
