# Use an official Node.js 16 image as a base
FROM node:22

# Set the working directory to /app
WORKDIR /app

# Copy the package.json file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application using Vite
RUN npm run build



# Expose the port the application will use
EXPOSE 3000

# Run the command to start the development server when the container launches
CMD ["npm", "run", "dev"]