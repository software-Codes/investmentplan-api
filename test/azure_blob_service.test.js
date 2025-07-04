const assert = require('assert');
const { describe, it } = require('node:test');
const AzureBlobStorageService = require('../src/authentication/src/services/azure-blob-storage-kyc/azure-blob-storage.service');

describe('AzureBlobStorageService _determineContentType', () => {
  const service = new AzureBlobStorageService({
    accountName: 'test',
    accountKey: 'test',
    containerName: 'container'
  });

  it('returns correct mime type for pdf', () => {
    assert.strictEqual(service._determineContentType('doc.pdf'), 'application/pdf');
  });

  it('returns correct mime type for jpg', () => {
    assert.strictEqual(service._determineContentType('image.JPG'), 'image/jpeg');
  });

  it('returns image/tiff for tif', () => {
    assert.strictEqual(service._determineContentType('scan.tif'), 'image/tiff');
  });

  it('defaults to application/octet-stream', () => {
    assert.strictEqual(service._determineContentType('file.unknown'), 'application/octet-stream');
  });
});
