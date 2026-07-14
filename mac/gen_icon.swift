// Renders the app icon (🍅 on a dark rounded tile) into an .iconset folder.
// Usage: swift gen_icon.swift /path/to/AppIcon.iconset

import AppKit

let outDir = URL(fileURLWithPath: CommandLine.arguments[1])

func render(_ pixels: Int) -> Data? {
    let s = CGFloat(pixels)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()

    let rect = NSRect(x: 0, y: 0, width: s, height: s)
    NSColor(red: 0.086, green: 0.106, blue: 0.137, alpha: 1).setFill()
    NSBezierPath(roundedRect: rect, xRadius: s * 0.22, yRadius: s * 0.22).fill()

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
    rep.size = NSSize(width: s, height: s) // keep 1 point == 1 pixel
    return rep.representation(using: .png, properties: [:])
}

// iconset naming: each point size at 1x and 2x.
let entries: [(name: String, pixels: Int)] = [
    ("icon_16x16", 16), ("icon_16x16@2x", 32),
    ("icon_32x32", 32), ("icon_32x32@2x", 64),
    ("icon_128x128", 128), ("icon_128x128@2x", 256),
    ("icon_256x256", 256), ("icon_256x256@2x", 512),
    ("icon_512x512", 512), ("icon_512x512@2x", 1024),
]

for entry in entries {
    guard let png = render(entry.pixels) else { continue }
    try? png.write(to: outDir.appendingPathComponent("\(entry.name).png"))
}
