FROM node:lts-alpine
 
USER root
WORKDIR /home/node
#ENV COMMAND=poweroff
ENV SITE=https://mr-v1.fly.dev GAMERS=30 STREAMS=1 ITERATIONS=1 TIMEOUT=420000
 
COPY . .
RUN npm install
 
ARG PORT
EXPOSE ${PORT:-3000}
 
CMD ["npm", "run", "start"]
