const { generateRegistrationOptions } = require('@simplewebauthn/server');
(async () => {
  try {
    const opts = await generateRegistrationOptions({
      rpID: '10.0.0.206',
      rpName: 'Test',
      userID: Buffer.from('test', 'utf8'),
      userName: 'test',
    });
    console.log("Success with IP:", opts.rp.id);
  } catch (e) {
    console.error("Error with IP:", e);
  }
})();
