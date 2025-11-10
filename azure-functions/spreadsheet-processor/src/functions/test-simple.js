const { app } = require('@azure/functions');

app.timer('test-simple', {
    schedule: '0 */5 * * * *',
    handler: (myTimer, context) => {
        context.log('✅ Simple test function works!');
    }
});
