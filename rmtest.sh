# remove logs and retest
rm *.log; FLY_MACHINE_ID=`date +%s` SITE=http://localhost:5000 GAMERS=1 STREAMS=1 ITERATIONS=1 TIMEOUT=420000 node index.js
#rm *.log; SITE=https://tableteacher.com GAMERS=1 STREAMS=1 ITERATIONS=1 TIMEOUT=420000 node index.js
#rm *.log; SITE=https://mr-v1.fly.dev STREAMS=1 GAMERS=1 ITERATIONS=1 TIMEOUT=420000 node index.js
