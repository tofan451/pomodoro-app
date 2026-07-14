// Renders the PWA / home-screen icons (🍅 on a dark rounded tile).
// Usage: swift gen_pwa_icons.swift /path/to/icons

import AppKit

let outDir = URL(fileURLWithPath: CommandLine.arguments[1])
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

func render(_ pixels: Int) -> Data? {
    let s = CGFloat(pixels)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()
    let rect = NSRect(x: 0, y: 0, width: s, height: s)
    NSColor(red: 0.086, green: 0.106, blue: 0.137, alpha: 1).setFill()
    // iOS masks its own corners, but rounded looks right elsewhere too.
    NSBezierPath(roundedRect: rect, xRadius: s * 0.18, yRadius: s * 0.18).fill()
    let emoji = "🍅" as NSString
    let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: s * 0.60)]
    let size = emoji.size(withAttributes: attrs)
    emoji.draw(
        at: NSPoint(x: (s - size.width) / 2, y: (s - size.height) / 2),
        withAttributes: attrs
    )
    image.unlockFocus()
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff) else { return nil }
    rep.size = NSSize(width: s, height: s)
    return rep.representation(using: .png, properties: [:])
}

for pixels in [180, 192, 512] {
    guard let png = render(pixels) else { continue }
    try? png.write(to: outDir.appendingPathComponent("icon-\(pixels).png"))
}
