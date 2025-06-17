# remove logs and retest
rm *.log; SITE=https://mr-v1.fly.dev STREAMS=1 ITERATIONS=1 TIMEOUT=420000 node index.js
