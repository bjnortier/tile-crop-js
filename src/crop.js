import { Box2, V2 } from 'vecks'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import Jimp from 'jimp'

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
    const parsedPNG = await Jimp.read(inputTile.bytes)
    const currentTileWidthCoords = inputTile.bbox.width
    const currentTileHeightCoords = inputTile.bbox.height
    if (i === 0) {
      tileWidthPX = parsedPNG.bitmap.width
      tileHeightPX = parsedPNG.bitmap.height
      tileWidthCoords = currentTileWidthCoords
      tileHeightCoords = currentTileHeightCoords
    } else {
      if ((parsedPNG.bitmap.width !== tileWidthPX) || (parsedPNG.bitmap.height !== tileHeightPX)) {
        throw Error(`tile at index ${i} has different pixel dimensions (${parsedPNG.bitmap.width}, ${parsedPNG.bitmap.height}) to the first tile (${tileWidthPX}, ${tileHeightPX})`)
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
  result.outputImageWidth = Math.round((result.bbox.width) / tileWidthCoords) * tileWidthPX
  result.outputImageHeight = Math.round((result.bbox.height) / tileHeightCoords) * tileHeightPX
  return result
}

const createImage = (width, height) => {
  return new Promise((resolve, reject) => {
    return new Jimp(width, height, 0x00000000, (err, img) => {
      if (err) {
        reject(err)
      } else {
        resolve(img)
      }
    })
  })
}

const getGeometryBBox = (geometry) => {
  return geometry.coordinates.reduce((acc, coordinateSet) => {
    return coordinateSet.reduce((acc, coordinate) => {
      return acc.expandByPoint(new V2(coordinate[0], coordinate[1]))
    }, acc)
  }, new Box2())
}

export const createCroppedImage = async (collected, geometry) => {
  const outputImage = await createImage(collected.outputImageWidth, collected.outputImageHeight)
  for (let i = 0; i < collected.tiles.length; ++i) {
    const inputPNG = collected.tiles[i].parsedPNG
    const inputBBox = collected.tiles[i].bbox
    const tileStartXPixel = (inputBBox.min.x - collected.bbox.min.x) / (collected.bbox.width) * collected.outputImageWidth
    const tileStartYPixel = -(inputBBox.max.y - collected.bbox.max.y) / (collected.bbox.height) * collected.outputImageHeight
    outputImage.blit(inputPNG, tileStartXPixel, tileStartYPixel)
  }
  const geometryBBox = getGeometryBBox(geometry)

  // Crop pixels
  const minX = Math.floor((geometryBBox.min.x - collected.bbox.min.x) / collected.bbox.width * collected.outputImageWidth)
  const maxX = Math.ceil((geometryBBox.max.x - collected.bbox.min.x) / collected.bbox.width * collected.outputImageWidth)
  const minY = Math.floor(-(geometryBBox.max.y - collected.bbox.max.y) / collected.bbox.height * collected.outputImageHeight)
  const maxY = Math.ceil(-(geometryBBox.min.y - collected.bbox.max.y) / collected.bbox.height * collected.outputImageHeight)

  // Recalculate the output coordinates bbox before cropping
  // as we have rounded the pixels the resulting bounding box
  // is slightly larger than the one for the boundary.
  const outputBBox = new Box2(
    new V2(
      collected.bbox.min.x + minX / outputImage.bitmap.width * collected.bbox.width,
      collected.bbox.max.y - maxY / outputImage.bitmap.height * collected.bbox.height),
    new V2(
      collected.bbox.min.x + maxX / outputImage.bitmap.width * collected.bbox.width,
      collected.bbox.max.y - minY / outputImage.bitmap.height * collected.bbox.height))

  outputImage.crop(minX, minY, maxX - minX, maxY - minY)
  const outputWidth = outputImage.bitmap.width
  const outputHeight = outputImage.bitmap.height
  outputImage.scan(0, 0, outputWidth, outputHeight, (pixelX, pixelY, index) => {
    // Don't bother with pixel that have not been copied from an image,
    // e.g. in the case of disjointed tiles
    if (outputImage.bitmap.data[index + 3] === 0) {
      return
    }

    const coordinate = [
      pixelX / outputWidth * outputBBox.width + outputBBox.min.x + (outputBBox.width / outputWidth / 2),
      outputBBox.max.y - pixelY / outputHeight * outputBBox.height - (outputBBox.height / outputHeight / 2)
    ]
    const inside = booleanPointInPolygon(coordinate, geometry)
    if (!inside) {
      outputImage.bitmap.data[index + 3] = 0
    }
  })
  // console.log(`[${i}/${collected.tiles.length}]`)

  return outputImage
}
