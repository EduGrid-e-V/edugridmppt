import { access } from 'node:fs/promises'
import { constants } from 'node:fs'

const contentDirectory = new URL('../content/', import.meta.url)

try {
  await access(contentDirectory, constants.R_OK)
  console.log('Content directory is readable; schemas are added in T-4.1.')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  console.log('No content directory yet; content validation starts in T-4.1.')
}
