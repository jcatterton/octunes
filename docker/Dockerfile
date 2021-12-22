FROM node:alpine
RUN apk add  --no-cache ffmpeg
WORKDIR /usr/src/octunes
COPY .. .
RUN npm install
CMD ["node", "."]
