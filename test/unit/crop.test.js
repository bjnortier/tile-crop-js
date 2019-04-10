import '@babel/polyfill'
import fs from 'fs'
import path from 'path'
import expect from 'expect'
import { Box2, V2 } from 'vecks'
//

import { collectTiles, createCroppedPNG } from '../../src/crop'

const testPNG10x10 = fs.readFileSync(path.join(__dirname, '..', '/resources/10x10.png'))
const testPNG100x100 = fs.readFileSync(path.join(__dirname, '..', '/resources/100x100.png'))

describe('crop', () => {
  // it.only('expects a polygon geometry', async () => {
  //   expect(async () => createCroppedPNG(null, { type: 'Point' }))
  //     .toThrow(`invalid geometry type: 'Point'. Expected 'Polygon'`)
  // })

  it('verifies the tiles', async () => {
    await expect(collectTiles([])).rejects.toThrow('empty tile array')

    await expect(collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(10, 10)), bytes: testPNG10x10 },
      { bbox: new Box2(new V2(10, 0), new V2(20, 10)), bytes: testPNG100x100 }
    ])).rejects.toThrow('tile at index 1 has different pixel dimensions (100, 100) to the first tile (10, 10)')

    await expect(collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(10, 10)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(10, 0), new V2(21, 10)), bytes: testPNG100x100 }
    ])).rejects.toThrow('tile at index 1 has different coordinate dimensions (11, 10) to the first tile (10, 10)')

    await expect(collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(10, 10)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(10, 0), new V2(20, 11)), bytes: testPNG100x100 }
    ])).rejects.toThrow('tile at index 1 has different coordinate dimensions (10, 11) to the first tile (10, 10)')
  })

  it('will collect the tiles 1', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(10, 10)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(10, 0), new V2(20, 10)), bytes: testPNG100x100 }
    ])
    expect(collected.bbox.min.x).toEqual(0)
    expect(collected.bbox.min.y).toEqual(0)
    expect(collected.bbox.max.x).toEqual(20)
    expect(collected.bbox.max.y).toEqual(10)
    expect(collected.tileWidthPX).toEqual(100)
    expect(collected.tileHeightPX).toEqual(100)
    expect(collected.requiredImageWidth).toEqual(200)
    expect(collected.requiredImageHeight).toEqual(100)
  })

  it('will collect the tiles 2', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(-5, 5), new V2(5, 10)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(5, 5), new V2(15, 10)), bytes: testPNG100x100 }
    ])
    expect(collected.bbox.min.x).toEqual(-5)
    expect(collected.bbox.min.y).toEqual(5)
    expect(collected.bbox.max.x).toEqual(15)
    expect(collected.bbox.max.y).toEqual(10)
    expect(collected.tileWidthPX).toEqual(100)
    expect(collected.tileHeightPX).toEqual(100)
    expect(collected.requiredImageWidth).toEqual(200)
    expect(collected.requiredImageHeight).toEqual(100)
  })

  it('will collect the tiles 3', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(0.5, -0.5), new V2(1.5, 0.5)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(0.5, 0.5), new V2(1.5, 1.5)), bytes: testPNG100x100 }
    ])
    expect(collected.bbox.min.x).toEqual(0.5)
    expect(collected.bbox.min.y).toEqual(-0.5)
    expect(collected.bbox.max.x).toEqual(1.5)
    expect(collected.bbox.max.y).toEqual(1.5)
    expect(collected.tileWidthPX).toEqual(100)
    expect(collected.tileHeightPX).toEqual(100)
    expect(collected.requiredImageWidth).toEqual(100)
    expect(collected.requiredImageHeight).toEqual(200)
  })

  it('will collect the tiles 3', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(0.5, -0.5), new V2(1.5, 0.5)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(0.5, 1.5), new V2(1.5, 2.5)), bytes: testPNG100x100 }
    ])
    expect(collected.bbox.min.x).toEqual(0.5)
    expect(collected.bbox.min.y).toEqual(-0.5)
    expect(collected.bbox.max.x).toEqual(1.5)
    expect(collected.bbox.max.y).toEqual(2.5)
    expect(collected.tileWidthPX).toEqual(100)
    expect(collected.tileHeightPX).toEqual(100)
    expect(collected.requiredImageWidth).toEqual(100)
    expect(collected.requiredImageHeight).toEqual(300)
  })

  it('can create an output image 1', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(100, 100)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(100, 0), new V2(200, 100)), bytes: testPNG100x100 }
    ])
    const geoJSONGeometry = {
      type: 'Polygon',
      coordinates: [[
        [50, 25],
        [150, 25],
        [150, 75],
        [100, 75],
        [100, 50],
        [50, 50]
      ]]
    }
    const buffer = await createCroppedPNG(collected, geoJSONGeometry)
    fs.writeFileSync(path.join(__dirname, '..', 'resources', 'output1.png'), buffer)
  })

  it('can create an output image 2', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(100, 100)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(0, 100), new V2(100, 200)), bytes: testPNG100x100 }
    ])
    const geoJSONGeometry = {
      type: 'Polygon',
      coordinates: [[
        [25, 50],
        [75, 50],
        [75, 150],
        [25, 150]
      ]]
    }
    const buffer = await createCroppedPNG(collected, geoJSONGeometry)
    fs.writeFileSync(path.join(__dirname, '..', 'resources', 'output2.png'), buffer)
  })

  it('can create an output image 3', async () => {
    const collected = await collectTiles([
      { bbox: new Box2(new V2(0, 0), new V2(100, 100)), bytes: testPNG100x100 },
      { bbox: new Box2(new V2(200, 0), new V2(300, 100)), bytes: testPNG100x100 }
    ])
    const geoJSONGeometry = {
      type: 'Polygon',
      coordinates: [[
        [10, 10],
        [290, 10],
        [290, 90],
        [10, 90]
      ]]
    }
    const buffer = await createCroppedPNG(collected, geoJSONGeometry)
    fs.writeFileSync(path.join(__dirname, '..', 'resources', 'output3.png'), buffer)
  })
})
