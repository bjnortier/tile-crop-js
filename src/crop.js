import { PNG } from 'pngjs'
import { Box2 } from 'vecks'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

const parsePNG = data => {
  return new Promise((resolve, reject) => {
    const _png = new PNG({ filterType: 4 })
      .parse(data)
      .on('parsed', () => {
        resolve(_png)
      })
  })
}

export const collectTiles = async (inputTiles) => {
  if (!inputTiles.length) {
    throw Error('empty tile array')
  }

  let tileWidthPX
  let tileHeightPX
  let tileWidthCoords
  let tileHeightCoords
  const result = {
    tiles: [],
    bbox: new Box2()
  }
  for (let i = 0; i < inputTiles.length; ++i) {
    const inputTile = inputTiles[i]
    const parsedPNG = await parsePNG(inputTile.bytes)
    const currentTileWidthCoords = inputTile.bbox.max.x - inputTile.bbox.min.x
    const currentTileHeightCoords = inputTile.bbox.max.y - inputTile.bbox.min.y
    if (i === 0) {
      tileWidthPX = parsedPNG.width
      tileHeightPX = parsedPNG.height
      tileWidthCoords = currentTileWidthCoords
      tileHeightCoords = currentTileHeightCoords
    } else {
      if ((parsedPNG.width !== tileWidthPX) || (parsedPNG.height !== tileHeightPX)) {
        throw Error(`tile at index ${i} has different pixel dimensions (${parsedPNG.width}, ${parsedPNG.height}) to the first tile (${tileWidthPX}, ${tileHeightPX})`)
      }
      if ((currentTileWidthCoords !== tileWidthCoords) || (currentTileHeightCoords !== tileHeightCoords)) {
        throw Error(`tile at index ${i} has different coordinate dimensions (${currentTileWidthCoords}, ${currentTileHeightCoords}) to the first tile (${tileWidthCoords}, ${tileHeightCoords})`)
      }
    }
    result.tiles[i] = {
      parsedPNG,
      bbox: inputTile.bbox
    }
    result.bbox.expandByPoint(inputTile.bbox.min)
    result.bbox.expandByPoint(inputTile.bbox.max)
  }
  result.tileWidthPX = tileWidthPX
  result.tileHeightPX = tileHeightPX
  result.requiredImageWidth = Math.round((result.bbox.max.x - result.bbox.min.x) / tileWidthCoords) * tileWidthPX
  result.requiredImageHeight = Math.round((result.bbox.max.y - result.bbox.min.y) / tileHeightCoords) * tileHeightPX
  return result
}

export const createCroppedPNG = async (collectedTiles, geometry) => {
  var outputPNG = new PNG({
    width: collectedTiles.requiredImageWidth,
    height: collectedTiles.requiredImageHeight,
    colorType: 6
  })
  for (let i = 0; i < outputPNG.width * outputPNG.height; ++i) {
    // outputPNG.data[i * 4] = 255
    outputPNG.data[i * 4 + 3] = 0
  }

  for (let i = 0; i < collectedTiles.tiles.length; ++i) {
    const inputPNG = collectedTiles.tiles[i].parsedPNG
    const inputBBox = collectedTiles.tiles[i].bbox
    const tileStartXPixel = inputBBox.min.x / (collectedTiles.bbox.max.x - collectedTiles.bbox.min.x) * collectedTiles.requiredImageWidth
    const tileStartYPixel = inputBBox.min.y / (collectedTiles.bbox.max.y - collectedTiles.bbox.min.y) * collectedTiles.requiredImageHeight
    for (var y = 0; y < inputPNG.height; y++) {
      for (var x = 0; x < inputPNG.width; x++) {
        const pixelX = tileStartXPixel + x
        const pixelY = tileStartYPixel + y
        const idx = pixelX + pixelY * collectedTiles.requiredImageWidth

        const coordinate = [
          pixelX / collectedTiles.requiredImageWidth * (collectedTiles.bbox.max.x - collectedTiles.bbox.min.x) + collectedTiles.bbox.min.x + ((collectedTiles.bbox.max.x - collectedTiles.bbox.min.x) / collectedTiles.requiredImageWidth / 2),
          collectedTiles.bbox.max.y - pixelY / collectedTiles.requiredImageHeight * (collectedTiles.bbox.max.y - collectedTiles.bbox.min.y) - ((collectedTiles.bbox.max.y - collectedTiles.bbox.min.y) / collectedTiles.requiredImageHeight / 2)
        ]

        const inside = booleanPointInPolygon(coordinate, geometry)
        const idx2 = (inputPNG.width * y + x) << 2
        outputPNG.data[(idx << 2) + 0] = inputPNG.data[idx2]
        outputPNG.data[(idx << 2) + 1] = inputPNG.data[idx2 + 1]
        outputPNG.data[(idx << 2) + 2] = inputPNG.data[idx2 + 2]
        if (inside) {
          outputPNG.data[(idx << 2) + 3] = 255
        } else {
          outputPNG.data[(idx << 2) + 3] = 0
        }
      }
    }
  }
  return PNG.sync.write(outputPNG)
}
