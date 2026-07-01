const crypto = require('crypto');
const fs = require('fs');

async function test() {
  const { generateKeyPairSync } = crypto;
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
  });
  
  const rawEntitySecret = crypto.randomBytes(32).toString('hex');
  const encryptedData = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(rawEntitySecret) // without 'hex' encoding, this is 64 bytes
  );

  const entitySecretCiphertext = encryptedData.toString('base64');
  fs.writeFileSync('scratch-test.txt', entitySecretCiphertext.length.toString());
}
test();
