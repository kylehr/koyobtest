FROM node:lts-alpine
 
USER root
WORKDIR /home/node
#ENV COMMAND=poweroff
ENV STREAMS=10
 
COPY . .
RUN npm install
 
ARG PORT
EXPOSE ${PORT:-3000}
 
CMD ["npm", "run", "start"]
