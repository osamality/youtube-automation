// Finds faces in a photo and cuts the main person out of the background (Apple Vision, macOS 14+).
//
//   photo-tool <in.jpg> [out-cutout.png]
//
// Prints JSON: {"width":W,"height":H,"faces":[{"x","y","w","h"}],"subject":{"x","y","w","h"}|null}
// Boxes are fractions of the image, measured from the top-left corner, biggest face first.
// The cut-out keeps only the person whose body holds the biggest face (or every subject when there is no face).
import CoreImage
import Foundation
import ImageIO
import Vision

struct Box: Codable { let x: Double; let y: Double; let w: Double; let h: Double }
struct Result: Codable { let width: Int; let height: Int; let faces: [Box]; let subject: Box? }

func topLeft(_ r: CGRect) -> Box {
  Box(x: r.minX, y: 1 - r.maxY, w: r.width, h: r.height)
}

let args = CommandLine.arguments
guard args.count >= 2,
  let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
  FileHandle.standardError.write("usage: photo-tool <in.jpg> [out.png]\n".data(using: .utf8)!)
  exit(2)
}

let handler = VNImageRequestHandler(cgImage: image, options: [:])
let faceRequest = VNDetectFaceRectanglesRequest()
let maskRequest = VNGenerateForegroundInstanceMaskRequest()
do {
  try handler.perform([faceRequest, maskRequest])
} catch {
  FileHandle.standardError.write("Vision failed: \(error)\n".data(using: .utf8)!)
  exit(1)
}

let faces = (faceRequest.results ?? [])
  .map { $0.boundingBox }
  .sorted { $0.width * $0.height > $1.width * $1.height }

var subject: Box? = nil
if let mask = maskRequest.results?.first, !mask.allInstances.isEmpty {
  // Pick the instance under the biggest face's centre; fall back to every instance.
  var instances = mask.allInstances
  if let face = faces.first {
    let labels = mask.instanceMask
    CVPixelBufferLockBaseAddress(labels, .readOnly)
    let w = CVPixelBufferGetWidth(labels)
    let h = CVPixelBufferGetHeight(labels)
    let row = CVPixelBufferGetBytesPerRow(labels)
    if let base = CVPixelBufferGetBaseAddress(labels) {
      let px = min(w - 1, max(0, Int(face.midX * Double(w))))
      let py = min(h - 1, max(0, Int((1 - face.midY) * Double(h))))
      let label = Int(base.load(fromByteOffset: py * row + px, as: UInt8.self))
      if label > 0 && mask.allInstances.contains(label) { instances = IndexSet(integer: label) }
    }
    CVPixelBufferUnlockBaseAddress(labels, .readOnly)
  }

  if args.count >= 3,
    let cut = try? mask.generateMaskedImage(
      ofInstances: instances, from: handler, croppedToInstancesExtent: false)
  {
    let ci = CIImage(cvPixelBuffer: cut)
    let context = CIContext()
    do {
      try context.writePNGRepresentation(
        of: ci, to: URL(fileURLWithPath: args[2]), format: .RGBA8,
        colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
    } catch {
      FileHandle.standardError.write("Could not write cut-out: \(error)\n".data(using: .utf8)!)
    }
    // Bounding box of the kept pixels.
    if let scaled = try? mask.generateScaledMaskForImage(forInstances: instances, from: handler) {
      CVPixelBufferLockBaseAddress(scaled, .readOnly)
      let w = CVPixelBufferGetWidth(scaled)
      let h = CVPixelBufferGetHeight(scaled)
      let row = CVPixelBufferGetBytesPerRow(scaled)
      var minX = w, minY = h, maxX = -1, maxY = -1
      if let base = CVPixelBufferGetBaseAddress(scaled) {
        // One float per pixel (0–1); sample every 4th pixel for speed.
        for y in stride(from: 0, to: h, by: 4) {
          for x in stride(from: 0, to: w, by: 4) {
            let v = base.load(fromByteOffset: y * row + x * 4, as: Float32.self)
            if v > 0.5 {
              minX = min(minX, x); maxX = max(maxX, x)
              minY = min(minY, y); maxY = max(maxY, y)
            }
          }
        }
      }
      CVPixelBufferUnlockBaseAddress(scaled, .readOnly)
      if maxX >= 0 {
        subject = Box(
          x: Double(minX) / Double(w), y: Double(minY) / Double(h),
          w: Double(maxX - minX + 4) / Double(w), h: Double(maxY - minY + 4) / Double(h))
      }
    }
  }
}

let result = Result(width: image.width, height: image.height, faces: faces.map(topLeft), subject: subject)
let json = try JSONEncoder().encode(result)
print(String(data: json, encoding: .utf8)!)
