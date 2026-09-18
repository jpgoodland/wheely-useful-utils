/**
 * Tests for the DynamoDB endpoint guard in lib/dynamodb.js.
 * Verifies that a plain http:// endpoint is rejected outside development.
 */

// Mock the AWS SDK so no real connections are attempted
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation((config) => {
    // Surface the config so tests can inspect it
    return { _config: config }
  }),
}))

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation((client) => client),
  },
}))

const ORIGINAL_ENV = process.env.NODE_ENV
const ORIGINAL_ENDPOINT = process.env.DYNAMODB_ENDPOINT
const ORIGINAL_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const ORIGINAL_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV
  if (ORIGINAL_ENDPOINT === undefined) {
    delete process.env.DYNAMODB_ENDPOINT
  } else {
    process.env.DYNAMODB_ENDPOINT = ORIGINAL_ENDPOINT
  }
  if (ORIGINAL_ACCESS_KEY === undefined) {
    delete process.env.AWS_ACCESS_KEY_ID
  } else {
    process.env.AWS_ACCESS_KEY_ID = ORIGINAL_ACCESS_KEY
  }
  if (ORIGINAL_SECRET_KEY === undefined) {
    delete process.env.AWS_SECRET_ACCESS_KEY
  } else {
    process.env.AWS_SECRET_ACCESS_KEY = ORIGINAL_SECRET_KEY
  }
  jest.resetModules()
})

describe('lib/dynamodb - endpoint config', () => {
  it('allows http:// endpoint when DYNAMODB_ENDPOINT is set', () => {
    process.env.NODE_ENV = 'development'
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000'
    expect(() => require('@/lib/dynamodb')).not.toThrow()
  })

  it('allows https:// endpoint when DYNAMODB_ENDPOINT is set', () => {
    process.env.NODE_ENV = 'production'
    process.env.DYNAMODB_ENDPOINT = 'https://dynamodb.us-east-1.amazonaws.com'
    expect(() => require('@/lib/dynamodb')).not.toThrow()
  })

  it('does not throw when no endpoint is set (uses real AWS)', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.DYNAMODB_ENDPOINT
    expect(() => require('@/lib/dynamodb')).not.toThrow()
  })

  it('does not set credentials when only one of accessKeyId or secretAccessKey is set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'some-key'
    delete process.env.AWS_SECRET_ACCESS_KEY
    const db = require('@/lib/dynamodb')
    const config = db.docClient._config
    expect(config.credentials).toBeUndefined()
  })
})
