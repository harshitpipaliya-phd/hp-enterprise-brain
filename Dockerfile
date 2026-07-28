FROM node:20-slim AS build
WORKDIR /repo
COPY package*.json ./
COPY contracts ./contracts
COPY web ./web
RUN npm install
RUN npm run generate
RUN cd web && npm run build

FROM node:20-slim AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /repo/web/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
