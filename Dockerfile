FROM node:lts-alpine
 
USER root
WORKDIR /home/node
#ENV COMMAND=poweroff
ENV SITE=https://mr-v1.fly.dev GAMERS=30 STREAMS=38 ITERATIONS=3 TIMEOUT=420000
 
COPY . .
RUN npm install
 
ARG PORT
EXPOSE ${PORT:-3000}
 
CMD ["npm", "run", "start"]
