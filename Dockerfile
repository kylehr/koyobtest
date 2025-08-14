FROM node:lts-alpine
 
USER root
WORKDIR /home/node
#ENV COMMAND=poweroff
ENV SITE=https://readytimestables.com GAMERS=30  STREAMS=1 ITERATIONS=1 TIMEOUT=420000
#ENV SITE=https://tableteacher.com GAMERS=20  STREAMS=1 ITERATIONS=1 TIMEOUT=420000
 
COPY . .
RUN npm install
 
ARG PORT
EXPOSE ${PORT:-3000}
 
CMD ["npm", "run", "start"]
