# Use Node.js LTS
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm install --omit=dev

# Copia todo o projeto
COPY . .

# Expõe a porta
EXPOSE 8080

# Start server
CMD ["node", "index.js"]
