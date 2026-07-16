// Renders the app icon into an .iconset folder: a round orange "watch"
// (gradient ring + clock hands) on a near-black tile, matching the app's UI.
// Usage: swift gen_icon.swift /path/to/AppIcon.iconset

import AppKit

let outDir = URL(fileURLWithPath: CommandLine.arguments[1])

func render(_ pixels: Int) -> Data? {
    let s = CGFloat(pixels)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else { image.unlockFocus(); return nil }

    // 1. Near-black rounded tile (matches the app's dark UI background).
    let rect = NSRect(x: 0, y: 0, width: s, height: s)
    NSColor(red: 0.043, green: 0.055, blue: 0.078, alpha: 1).setFill() // ~#0b0e14
    NSBezierPath(roundedRect: rect, xRadius: s * 0.22, yRadius: s * 0.22).fill()

    let cx = s * 0.5, cy = s * 0.5
    // Large, thin ring: fills more of the tile and reads more modern.
    let ringR = s * 0.36
    let ringW = s * 0.058

    // Orange colours taken from the app (--grad-a / --grad-b / --accent).
    let gradA = NSColor(red: 1.0, green: 0.541, blue: 0.361, alpha: 1) // #ff8a5c
    let gradB = NSColor(red: 1.0, green: 0.341, blue: 0.341, alpha: 1) // #ff5757
    let accent = NSColor(red: 1.0, green: 0.42, blue: 0.34, alpha: 1)  // #ff6b57

    // 2. Soft orange glow behind the ring (echoes the UI ring's shadow).
    ctx.saveGState()
    if let glow = NSGradient(colors: [accent.withAlphaComponent(0.30), accent.withAlphaComponent(0.0)]) {
        glow.draw(fromCenter: NSPoint(x: cx, y: cy), radius: 0,
                  toCenter: NSPoint(x: cx, y: cy), radius: ringR + ringW * 1.6, options: [])
    }
    ctx.restoreGState()

    // 3. Gradient-filled ring (annulus), 135° like the UI countdown ring.
    let outer = ringR + ringW / 2
    let inner = ringR - ringW / 2
    let ringPath = NSBezierPath()
    ringPath.appendOval(in: NSRect(x: cx - outer, y: cy - outer, width: outer * 2, height: outer * 2))
    ringPath.appendOval(in: NSRect(x: cx - inner, y: cy - inner, width: inner * 2, height: inner * 2))
    ringPath.windingRule = .evenOdd
    ctx.saveGState()
    ringPath.addClip()
    NSGradient(starting: gradA, ending: gradB)?.draw(in: rect, angle: -45)
    ctx.restoreGState()

    // 4. Clock hands (classic 10:10 pose) + centre hub — reads as a watch.
    func hand(_ clockDeg: CGFloat, _ length: CGFloat, _ width: CGFloat, _ color: NSColor) {
        let a = clockDeg * .pi / 180
        let p = NSBezierPath()
        p.move(to: NSPoint(x: cx, y: cy))
        p.line(to: NSPoint(x: cx + length * sin(a), y: cy + length * cos(a)))
        p.lineWidth = width
        p.lineCapStyle = .round
        color.setStroke()
        p.stroke()
    }
    let handColor = NSColor(red: 0.965, green: 0.95, blue: 0.925, alpha: 1) // warm white
    hand(60, s * 0.24, s * 0.034, handColor)     // minute hand -> 2 o'clock
    hand(-60, s * 0.16, s * 0.04, handColor)     // hour hand   -> 10 o'clock

    let hub = s * 0.03
    accent.setFill()
    NSBezierPath(ovalIn: NSRect(x: cx - hub, y: cy - hub, width: hub * 2, height: hub * 2)).fill()

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
