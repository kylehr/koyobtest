FROM node:lts-alpine
 
USER root
WORKDIR /home/node
ENV COMMAND=poweroff
 
COPY . .
RUN npm install
 
ARG PORT
EXPOSE ${PORT:-3000}
 
CMD ["npm", "run", "start"]
