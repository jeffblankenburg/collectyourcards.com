#!/usr/bin/env node

/**
 * Azure Web App startup script
 * Ensures Prisma client is generated before starting the server
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Collect Your Cards application...');

// Check if Prisma client exists
const prismaClientPath = path.join(__dirname, 'node_modules/.prisma/client');
const prismaClientExists = fs.existsSync(prismaClientPath);

console.log(`📁 Checking Prisma client: ${prismaClientExists ? '✅ Found' : '❌ Missing'}`);

if (!prismaClientExists) {
    console.log('🔧 Generating Prisma client...');
    
    exec('npx prisma generate', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Prisma generate failed:', error.message);
            console.error('stderr:', stderr);
            console.log('🔄 Attempting to start server anyway...');
        } else {
            console.log('✅ Prisma client generated successfully');
            console.log('stdout:', stdout);
        }
        
        // Start the actual server
        console.log('🚀 Starting server...');
        require('./server/server.js');
    });
} else {
    console.log('✅ Prisma client already exists, starting server...');
    require('./server/server.js');
}