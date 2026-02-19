fetch('http://localhost:3000/api/setup-tester')
    .then(res => res.text())
    .then(console.log)
    .catch(console.error)
