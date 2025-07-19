# Usa uma imagem base oficial do Node.js, que é leve e otimizada.
FROM node:18-slim

# Cria e define o diretório de trabalho dentro do contêiner.
WORKDIR /usr/src/app

# Copia os arquivos de definição de pacotes.
COPY package*.json ./

# Instala todas as dependências que nossa API precisa.
RUN npm install

# Copia todo o resto do nosso código (o index.js e quaisquer outros arquivos).
COPY . .

# Expõe a porta 3000, que é a porta que nosso servidor escuta.
EXPOSE 3000

# O comando final que é executado quando o contêiner inicia.
CMD [ "node", "index.js" ]
