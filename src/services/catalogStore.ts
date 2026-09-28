import { createLocalCatalog, type CatalogBundle } from '@/data/localCatalog'
import type { DataSource } from '@/types'

let catalog: CatalogBundle = createLocalCatalog()
let source: DataSource = 'local'

export function getCatalog(): CatalogBundle {
  return catalog
}

export function getCatalogSource(): DataSource {
  return source
}

export function setCatalog(next: CatalogBundle, nextSource: DataSource) {
  catalog = next
  source = nextSource
}

export function resetCatalogToLocal() {
  catalog = createLocalCatalog()
  source = 'local'
}
