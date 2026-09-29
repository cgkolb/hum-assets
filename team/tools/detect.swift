import Foundation
import CoreImage
import Vision
import AppKit

// Detect the face box and the subject matte, and hand both to the caller.
// Compositing happens downstream in 8-bit sRGB, where the maths is predictable
// -- CoreImage's implicit linear working space crushes dark background colours.
//
// usage: detect <in> <maskOut.png>   -> prints JSON on stdout

let args = CommandLine.arguments
if args.count < 3 { fputs("bad args\n", stderr); exit(2) }
let inURL = URL(fileURLWithPath: args[1])
let maskURL = URL(fileURLWithPath: args[2])

let opts: [CIImageOption: Any] = [CIImageOption.applyOrientationProperty: true]
guard let src = CIImage(contentsOf: inURL, options: opts) else {
    fputs("cannot read\n", stderr); exit(1)
}
let W: Double = Double(src.extent.width)
let H: Double = Double(src.extent.height)
let handler = VNImageRequestHandler(ciImage: src, options: [:])

let faceReq = VNDetectFaceRectanglesRequest()
try handler.perform([faceReq])
guard let faces = faceReq.results, !faces.isEmpty else {
    fputs("NO_FACE\n", stderr); exit(3)
}
var face: VNFaceObservation = faces[0]
for f in faces where f.boundingBox.height > face.boundingBox.height { face = f }
let bb: CGRect = face.boundingBox
let fx: Double = Double(bb.minX) * W
let fw: Double = Double(bb.width) * W
let fh: Double = Double(bb.height) * H
// Vision uses a bottom-left origin; report top-left to match image tooling.
let fy: Double = (1.0 - (Double(bb.minY) + Double(bb.height))) * H
let fcx: Double = fx + fw / 2.0
let fcy: Double = fy + fh / 2.0

let ctx = CIContext()
var haveMask = false

let maskReq = VNGenerateForegroundInstanceMaskRequest()
do {
    try handler.perform([maskReq])
    if let obs = maskReq.results?.first, !obs.allInstances.isEmpty {
        // Vision happily returns several "subjects" -- a shrub behind the
        // shoulder counts. Keep only the instance the face sits in.
        func score(_ img: CIImage) -> Double {
            let sx = Double(img.extent.width) / W
            let sy = Double(img.extent.height) / H
            let px = img.extent.minX + CGFloat(fcx * sx)
            let py = img.extent.minY + CGFloat((H - fcy) * sy)
            var px4 = [UInt8](repeating: 0, count: 4)
            ctx.render(img, toBitmap: &px4, rowBytes: 4,
                       bounds: CGRect(x: px, y: py, width: 1, height: 1),
                       format: CIFormat.RGBA8, colorSpace: nil)
            return Double(px4[0]) / 255.0
        }
        var chosen: CIImage? = nil
        var best = 0.0
        for idx in obs.allInstances {
            guard let b = try? obs.generateScaledMaskForImage(
                forInstances: IndexSet(integer: idx), from: handler) else { continue }
            let m = CIImage(cvPixelBuffer: b)
            let sc = score(m)
            if sc > best { best = sc; chosen = m }
        }
        if chosen == nil || best < 0.5 {
            let b = try obs.generateScaledMaskForImage(forInstances: obs.allInstances,
                                                       from: handler)
            chosen = CIImage(cvPixelBuffer: b)
        }
        var mask = chosen!
        let sx: Double = W / Double(mask.extent.width)
        let sy: Double = H / Double(mask.extent.height)
        if sx != 1.0 || sy != 1.0 {
            mask = mask.transformed(by: CGAffineTransform(scaleX: CGFloat(sx), y: CGFloat(sy)))
        }
        mask = mask.transformed(by: CGAffineTransform(translationX: -mask.extent.minX,
                                                      y: -mask.extent.minY))
        let gray = CGColorSpace(name: CGColorSpace.linearGray)!
        try ctx.writePNGRepresentation(of: mask, to: maskURL, format: CIFormat.L8,
                                       colorSpace: gray, options: [:])
        haveMask = true
    }
} catch {
    haveMask = false
}

let json = String(format:
    "{\"w\":%.0f,\"h\":%.0f,\"fx\":%.2f,\"fy\":%.2f,\"fw\":%.2f,\"fh\":%.2f,\"mask\":%@}",
    W, H, fx, fy, fw, fh, haveMask ? "true" : "false")
print(json)
