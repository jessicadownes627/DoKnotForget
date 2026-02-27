#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>

static void die(NSString *message) {
  fprintf(stderr, "%s\n", message.UTF8String);
  exit(2);
}

static BOOL ensureDir(NSString *path, NSError **error) {
  return [[NSFileManager defaultManager] createDirectoryAtPath:path
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:error];
}

static CGImageRef loadImageAtPath(NSString *path) {
  NSURL *url = [NSURL fileURLWithPath:path];
  CGImageSourceRef src = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
  if (!src) return NULL;
  CGImageRef img = CGImageSourceCreateImageAtIndex(src, 0, NULL);
  CFRelease(src);
  return img;
}

static CGContextRef makeRGBAContext(size_t width, size_t height, uint8_t **outData) {
  size_t bytesPerRow = width * 4;
  uint8_t *data = (uint8_t *)calloc(height * bytesPerRow, 1);
  if (!data) return NULL;
  CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
  CGBitmapInfo info = (CGBitmapInfo)kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big;
  CGContextRef ctx = CGBitmapContextCreate(data, width, height, 8, bytesPerRow, cs, info);
  CGColorSpaceRelease(cs);
  if (!ctx) {
    free(data);
    return NULL;
  }
  CGContextSetInterpolationQuality(ctx, kCGInterpolationHigh);
  *outData = data;
  return ctx;
}

static void sampleBackground(const uint8_t *pixels, size_t width, size_t height, size_t bytesPerRow,
                             CGFloat *outR, CGFloat *outG, CGFloat *outB) {
  size_t sample = MIN((size_t)20, MIN(width, height) / 10);
  if (sample < 4) sample = MIN(width, height);

  const size_t corners[4][2] = {
    {0, 0},
    {width - sample, 0},
    {0, height - sample},
    {width - sample, height - sample},
  };

  double sumR = 0, sumG = 0, sumB = 0;
  double count = 0;

  for (int c = 0; c < 4; c++) {
    size_t sx = corners[c][0];
    size_t sy = corners[c][1];
    for (size_t y = sy; y < sy + sample; y++) {
      const uint8_t *row = pixels + y * bytesPerRow;
      for (size_t x = sx; x < sx + sample; x++) {
        const uint8_t *px = row + x * 4;
        sumR += px[0] / 255.0;
        sumG += px[1] / 255.0;
        sumB += px[2] / 255.0;
        count += 1.0;
      }
    }
  }

  *outR = (CGFloat)(sumR / count);
  *outG = (CGFloat)(sumG / count);
  *outB = (CGFloat)(sumB / count);
}

static inline CGFloat colorDistance(CGFloat r, CGFloat g, CGFloat b, CGFloat br, CGFloat bg, CGFloat bb) {
  CGFloat dr = r - br, dg = g - bg, db = b - bb;
  return (CGFloat)sqrt(dr * dr + dg * dg + db * db);
}

static void applyChromaMatte(uint8_t *pixels, size_t width, size_t height, size_t bytesPerRow,
                             CGFloat br, CGFloat bg, CGFloat bb, CGFloat low, CGFloat high) {
  for (size_t y = 0; y < height; y++) {
    uint8_t *row = pixels + y * bytesPerRow;
    for (size_t x = 0; x < width; x++) {
      uint8_t *px = row + x * 4;
      CGFloat r = px[0] / 255.0, g = px[1] / 255.0, b = px[2] / 255.0;
      CGFloat d = colorDistance(r, g, b, br, bg, bb);

      CGFloat a;
      if (d <= low) a = 0;
      else if (d >= high) a = 1;
      else a = (d - low) / (high - low);

      int alpha = (int)llround(a * 255.0);
      if (alpha < 0) alpha = 0;
      if (alpha > 255) alpha = 255;
      px[3] = (uint8_t)alpha;
    }
  }
}

static void decontaminateEdges(uint8_t *pixels, size_t width, size_t height, size_t bytesPerRow,
                               CGFloat br, CGFloat bg, CGFloat bb) {
  // Attempt to remove navy “spill” from semi-transparent edge pixels:
  // If source was composited over the sampled background, we can estimate original RGB.
  const CGFloat eps = 1.0 / 255.0;
  for (size_t y = 0; y < height; y++) {
    uint8_t *row = pixels + y * bytesPerRow;
    for (size_t x = 0; x < width; x++) {
      uint8_t *px = row + x * 4;
      CGFloat a = px[3] / 255.0;
      if (a <= 0.0) continue;

      CGFloat r = px[0] / 255.0;
      CGFloat g = px[1] / 255.0;
      CGFloat b = px[2] / 255.0;

      CGFloat denom = (a < eps) ? eps : a;
      // Reverse “over” compositing: C = a*F + (1-a)*B  =>  F = (C - (1-a)*B)/a
      r = (r - (1.0 - a) * br) / denom;
      g = (g - (1.0 - a) * bg) / denom;
      b = (b - (1.0 - a) * bb) / denom;

      if (r < 0) r = 0; if (r > 1) r = 1;
      if (g < 0) g = 0; if (g > 1) g = 1;
      if (b < 0) b = 0; if (b > 1) b = 1;

      px[0] = (uint8_t)llround(r * 255.0);
      px[1] = (uint8_t)llround(g * 255.0);
      px[2] = (uint8_t)llround(b * 255.0);
    }
  }
}

static BOOL alphaBoundingBox(const uint8_t *pixels, size_t width, size_t height, size_t bytesPerRow,
                             uint8_t threshold, CGRect *outRect) {
  int minX = (int)width, minY = (int)height, maxX = -1, maxY = -1;
  for (size_t y = 0; y < height; y++) {
    const uint8_t *row = pixels + y * bytesPerRow;
    for (size_t x = 0; x < width; x++) {
      const uint8_t *px = row + x * 4;
      if (px[3] > threshold) {
        if ((int)x < minX) minX = (int)x;
        if ((int)y < minY) minY = (int)y;
        if ((int)x > maxX) maxX = (int)x;
        if ((int)y > maxY) maxY = (int)y;
      }
    }
  }
  if (maxX < 0) return NO;
  *outRect = CGRectMake(minX, minY, (maxX - minX + 1), (maxY - minY + 1));
  return YES;
}

static CGImageRef drawCenteredSquare(CGImageRef extracted, CGRect bbox, size_t canvas,
                                    CGFloat paddingFraction, CGColorRef backgroundOrNull) {
  uint8_t *outData = NULL;
  CGContextRef ctx = makeRGBAContext(canvas, canvas, &outData);
  if (!ctx) return NULL;

  if (backgroundOrNull) {
    CGContextSetFillColorWithColor(ctx, backgroundOrNull);
    CGContextFillRect(ctx, CGRectMake(0, 0, canvas, canvas));
  }

  CGImageRef cropped = CGImageCreateWithImageInRect(extracted, bbox);
  if (!cropped) cropped = CGImageRetain(extracted);

  CGFloat pad = (CGFloat)canvas * paddingFraction;
  CGFloat targetSide = (CGFloat)canvas - pad * 2.0;
  CGFloat cw = (CGFloat)CGImageGetWidth(cropped);
  CGFloat ch = (CGFloat)CGImageGetHeight(cropped);
  CGFloat scale = MIN(targetSide / cw, targetSide / ch);
  CGFloat dw = cw * scale;
  CGFloat dh = ch * scale;
  CGFloat dx = ((CGFloat)canvas - dw) / 2.0;
  CGFloat dy = ((CGFloat)canvas - dh) / 2.0;

  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, 0, (CGFloat)canvas);
  CGContextScaleCTM(ctx, 1, -1);
  CGContextDrawImage(ctx, CGRectMake(dx, dy, dw, dh), cropped);
  CGContextRestoreGState(ctx);

  CGImageRelease(cropped);
  CGImageRef out = CGBitmapContextCreateImage(ctx);
  CGContextRelease(ctx);
  free(outData);
  return out;
}

static void drawAspectFill(CGContextRef ctx, CGImageRef image, size_t canvas) {
  size_t sw = CGImageGetWidth(image);
  size_t sh = CGImageGetHeight(image);
  CGFloat scale = MAX((CGFloat)canvas / (CGFloat)sw, (CGFloat)canvas / (CGFloat)sh);
  CGFloat dw = (CGFloat)sw * scale;
  CGFloat dh = (CGFloat)sh * scale;
  CGFloat dx = ((CGFloat)canvas - dw) / 2.0;
  CGFloat dy = ((CGFloat)canvas - dh) / 2.0;

  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, 0, (CGFloat)canvas);
  CGContextScaleCTM(ctx, 1, -1);
  CGContextDrawImage(ctx, CGRectMake(dx, dy, dw, dh), image);
  CGContextRestoreGState(ctx);
}

static void drawAspectFit(CGContextRef ctx, CGImageRef image, size_t canvas) {
  size_t sw = CGImageGetWidth(image);
  size_t sh = CGImageGetHeight(image);
  CGFloat scale = MIN((CGFloat)canvas / (CGFloat)sw, (CGFloat)canvas / (CGFloat)sh);
  CGFloat dw = (CGFloat)sw * scale;
  CGFloat dh = (CGFloat)sh * scale;
  CGFloat dx = ((CGFloat)canvas - dw) / 2.0;
  CGFloat dy = ((CGFloat)canvas - dh) / 2.0;

  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, 0, (CGFloat)canvas);
  CGContextScaleCTM(ctx, 1, -1);
  CGContextDrawImage(ctx, CGRectMake(dx, dy, dw, dh), image);
  CGContextRestoreGState(ctx);
}

static CGImageRef drawIconOverSourceBackground(CGImageRef sourceBg, CGImageRef extracted, CGRect bbox,
                                               size_t canvas, CGFloat paddingFraction) {
  uint8_t *outData = NULL;
  CGContextRef ctx = makeRGBAContext(canvas, canvas, &outData);
  if (!ctx) return NULL;

  // Background: preserve the original navy texture/gradient without cropping.
  // Fill base with the corner-sampled navy, then aspect-fit the source over it.
  // This keeps the “sheet” feeling closer to the original reference.
  // Note: source is near-square; any margins should be minimal.
  // (We set fill color before calling this function.)
  drawAspectFit(ctx, sourceBg, canvas);

  // Foreground: center the extracted ribbon-K with safe-area padding.
  CGImageRef cropped = CGImageCreateWithImageInRect(extracted, bbox);
  if (!cropped) cropped = CGImageRetain(extracted);

  CGFloat pad = (CGFloat)canvas * paddingFraction;
  CGFloat targetSide = (CGFloat)canvas - pad * 2.0;
  CGFloat cw = (CGFloat)CGImageGetWidth(cropped);
  CGFloat ch = (CGFloat)CGImageGetHeight(cropped);
  CGFloat scale = MIN(targetSide / cw, targetSide / ch);
  CGFloat dw = cw * scale;
  CGFloat dh = ch * scale;
  CGFloat dx = ((CGFloat)canvas - dw) / 2.0;
  CGFloat dy = ((CGFloat)canvas - dh) / 2.0;

  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, 0, (CGFloat)canvas);
  CGContextScaleCTM(ctx, 1, -1);
  CGContextDrawImage(ctx, CGRectMake(dx, dy, dw, dh), cropped);
  CGContextRestoreGState(ctx);

  CGImageRelease(cropped);
  CGImageRef out = CGBitmapContextCreateImage(ctx);
  CGContextRelease(ctx);
  free(outData);
  return out;
}

static BOOL writePNG(CGImageRef image, NSString *path, NSError **error) {
  NSURL *url = [NSURL fileURLWithPath:path];
  CGImageDestinationRef dest = CGImageDestinationCreateWithURL((__bridge CFURLRef)url, CFSTR("public.png"), 1, NULL);
  if (!dest) {
    if (error) *error = [NSError errorWithDomain:@"dkf" code:1 userInfo:@{NSLocalizedDescriptionKey:@"Failed to create PNG destination"}];
    return NO;
  }
  CGImageDestinationAddImage(dest, image, NULL);
  BOOL ok = CGImageDestinationFinalize(dest);
  CFRelease(dest);
  if (!ok && error) *error = [NSError errorWithDomain:@"dkf" code:2 userInfo:@{NSLocalizedDescriptionKey:@"Failed to finalize PNG"}];
  return ok;
}

static BOOL writePDF(CGImageRef image, size_t canvas, NSString *path) {
  NSURL *url = [NSURL fileURLWithPath:path];
  CGRect box = CGRectMake(0, 0, canvas, canvas);
  CGContextRef pdf = CGPDFContextCreateWithURL((__bridge CFURLRef)url, &box, NULL);
  if (!pdf) return NO;
  CGPDFContextBeginPage(pdf, NULL);
  CGContextSaveGState(pdf);
  CGContextTranslateCTM(pdf, 0, (CGFloat)canvas);
  CGContextScaleCTM(pdf, 1, -1);
  CGContextDrawImage(pdf, CGRectMake(0, 0, canvas, canvas), image);
  CGContextRestoreGState(pdf);
  CGPDFContextEndPage(pdf);
  CGContextRelease(pdf);
  return YES;
}

static BOOL writeSVGEmbedPNG(NSString *pngPath, size_t canvas, NSString *svgPath, NSError **error) {
  NSData *png = [NSData dataWithContentsOfFile:pngPath options:0 error:error];
  if (!png) return NO;
  NSString *b64 = [png base64EncodedStringWithOptions:0];
  NSString *svg = [NSString stringWithFormat:
                   @"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"%zu\" height=\"%zu\" viewBox=\"0 0 %zu %zu\">"
                   @"<image href=\"data:image/png;base64,%@\" x=\"0\" y=\"0\" width=\"%zu\" height=\"%zu\"/>"
                   @"</svg>\n",
                   canvas, canvas, canvas, canvas, b64, canvas, canvas];
  return [svg writeToFile:svgPath atomically:YES encoding:NSUTF8StringEncoding error:error];
}

static CGImageRef resize(CGImageRef image, size_t w, size_t h) {
  uint8_t *data = NULL;
  CGContextRef ctx = makeRGBAContext(w, h, &data);
  if (!ctx) return NULL;
  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, 0, (CGFloat)h);
  CGContextScaleCTM(ctx, 1, -1);
  CGContextDrawImage(ctx, CGRectMake(0, 0, w, h), image);
  CGContextRestoreGState(ctx);
  CGImageRef out = CGBitmapContextCreateImage(ctx);
  CGContextRelease(ctx);
  free(data);
  return out;
}

static CGImageRef squareCrop(CGImageRef image) {
  size_t w = CGImageGetWidth(image);
  size_t h = CGImageGetHeight(image);
  size_t side = MIN(w, h);

  // Center-crop to square.
  size_t x = (w > side) ? ((w - side) / 2) : 0;
  size_t y = (h > side) ? ((h - side) / 2) : 0;

  return CGImageCreateWithImageInRect(image, CGRectMake((CGFloat)x, (CGFloat)y, (CGFloat)side, (CGFloat)side));
}

static NSString *contentsJSON(void) {
  // Minimal required iOS icon set (iPhone + iPad + marketing).
  return
  @"{\n"
  @"  \"images\" : [\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"20x20\",\"scale\":\"2x\",\"filename\":\"AppIcon-20@2x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"20x20\",\"scale\":\"3x\",\"filename\":\"AppIcon-20@3x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"29x29\",\"scale\":\"2x\",\"filename\":\"AppIcon-29@2x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"29x29\",\"scale\":\"3x\",\"filename\":\"AppIcon-29@3x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"40x40\",\"scale\":\"2x\",\"filename\":\"AppIcon-40@2x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"40x40\",\"scale\":\"3x\",\"filename\":\"AppIcon-40@3x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"60x60\",\"scale\":\"2x\",\"filename\":\"AppIcon-60@2x.png\"},\n"
  @"    {\"idiom\":\"iphone\",\"size\":\"60x60\",\"scale\":\"3x\",\"filename\":\"AppIcon-60@3x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"20x20\",\"scale\":\"1x\",\"filename\":\"AppIcon-20@1x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"20x20\",\"scale\":\"2x\",\"filename\":\"AppIcon-20@2x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"29x29\",\"scale\":\"1x\",\"filename\":\"AppIcon-29@1x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"29x29\",\"scale\":\"2x\",\"filename\":\"AppIcon-29@2x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"40x40\",\"scale\":\"1x\",\"filename\":\"AppIcon-40@1x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"40x40\",\"scale\":\"2x\",\"filename\":\"AppIcon-40@2x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"76x76\",\"scale\":\"1x\",\"filename\":\"AppIcon-76@1x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"76x76\",\"scale\":\"2x\",\"filename\":\"AppIcon-76@2x.png\"},\n"
  @"    {\"idiom\":\"ipad\",\"size\":\"83.5x83.5\",\"scale\":\"2x\",\"filename\":\"AppIcon-83.5@2x.png\"},\n"
  @"    {\"idiom\":\"ios-marketing\",\"size\":\"1024x1024\",\"scale\":\"1x\",\"filename\":\"AppIcon-1024.png\"}\n"
  @"  ],\n"
  @"  \"info\" : {\"author\":\"xcode\",\"version\":1}\n"
  @"}\n";
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSString *input = nil;
    NSString *outLogo = @"assets/logo";
    NSString *outAppIcon = @"assets/appicon";
    NSInteger logoSize = 2048;
    NSInteger iconSize = 1024;
    CGFloat padding = 0.14;
    CGFloat matteLow = 0.06;
    CGFloat matteHigh = 0.14;
    BOOL keepBackground = NO;

    for (int i = 1; i < argc; i++) {
      NSString *a = [NSString stringWithUTF8String:argv[i]];
      NSString *v = (i + 1 < argc) ? [NSString stringWithUTF8String:argv[i + 1]] : nil;

      if ([a isEqualToString:@"--input"]) { input = v; if (v) i++; }
      else if ([a isEqualToString:@"--out-logo"]) { outLogo = v ?: outLogo; if (v) i++; }
      else if ([a isEqualToString:@"--out-appicon"]) { outAppIcon = v ?: outAppIcon; if (v) i++; }
      else if ([a isEqualToString:@"--logo-size"]) { logoSize = (v ?: @"2048").integerValue; if (v) i++; }
      else if ([a isEqualToString:@"--icon-size"]) { iconSize = (v ?: @"1024").integerValue; if (v) i++; }
      else if ([a isEqualToString:@"--padding"]) { padding = (CGFloat)((v ?: @"0.14").doubleValue); if (v) i++; }
      else if ([a isEqualToString:@"--matte-low"]) { matteLow = (CGFloat)((v ?: @"0.06").doubleValue); if (v) i++; }
      else if ([a isEqualToString:@"--matte-high"]) { matteHigh = (CGFloat)((v ?: @"0.14").doubleValue); if (v) i++; }
      else if ([a isEqualToString:@"--keep-background"]) { keepBackground = YES; }
      else if ([a isEqualToString:@"--help"] || [a isEqualToString:@"-h"]) {
        die(@"Usage: clang -framework Foundation -framework CoreGraphics -framework ImageIO scripts/generate_dkf_brand_assets.m -o /tmp/dkf_assets && /tmp/dkf_assets --input <path>");
      }
    }

    if (!input.length) die(@"Missing --input <path>");

    NSError *err = nil;
    if (!ensureDir(outLogo, &err)) die([NSString stringWithFormat:@"Failed to create %@: %@", outLogo, err.localizedDescription]);
    if (!ensureDir(outAppIcon, &err)) die([NSString stringWithFormat:@"Failed to create %@: %@", outAppIcon, err.localizedDescription]);
    ensureDir(@"assets/source", NULL);

    CGImageRef src = loadImageAtPath(input);
    if (!src) die([NSString stringWithFormat:@"Failed to load image: %@", input]);

    size_t w = CGImageGetWidth(src);
    size_t h = CGImageGetHeight(src);

    // Always square-crop the source for logo + icon exports (no transparency in keep-background mode).
    CGImageRef srcSquare = squareCrop(src);
    if (!srcSquare) die(@"Failed to square-crop source image");

    CGFloat br = 0, bg = 0, bb = 0;

    // Only used for matte mode.
    uint8_t *data = NULL;
    CGContextRef ctx = NULL;
    CGImageRef extracted = NULL;
    CGRect bbox = CGRectZero;

    if (!keepBackground) {
      ctx = makeRGBAContext(w, h, &data);
      if (!ctx) die(@"Failed to allocate bitmap context");

      CGContextSaveGState(ctx);
      CGContextTranslateCTM(ctx, 0, (CGFloat)h);
      CGContextScaleCTM(ctx, 1, -1);
      CGContextDrawImage(ctx, CGRectMake(0, 0, w, h), src);
      CGContextRestoreGState(ctx);

      sampleBackground(data, w, h, w * 4, &br, &bg, &bb);
      applyChromaMatte(data, w, h, w * 4, br, bg, bb, matteLow, matteHigh);
      decontaminateEdges(data, w, h, w * 4, br, bg, bb);

      extracted = CGBitmapContextCreateImage(ctx);
      if (!alphaBoundingBox(data, w, h, w * 4, 10, &bbox)) {
        die(@"No foreground pixels detected (try adjusting --matte-low/--matte-high)");
      }
    }

    NSString *logoPNG = [outLogo stringByAppendingPathComponent:@"dkf-ribbon-k.png"];
    NSString *logoSVG = [outLogo stringByAppendingPathComponent:@"dkf-ribbon-k.svg"];
    NSString *logoPDF = [outLogo stringByAppendingPathComponent:@"dkf-ribbon-k.pdf"];

    // Logo + SVG/PDF exports
    if (keepBackground) {
      CGImageRef logo = resize(srcSquare, (size_t)logoSize, (size_t)logoSize);
      if (!logo) die(@"Failed to resize logo");
      if (!writePNG(logo, logoPNG, &err)) die([NSString stringWithFormat:@"Failed to write PNG: %@", err.localizedDescription]);
      writeSVGEmbedPNG(logoPNG, (size_t)logoSize, logoSVG, &err);
      // Keep PDF export for convenience (embedded raster, no masking).
      writePDF(logo, (size_t)logoSize, logoPDF);
      CGImageRelease(logo);
    } else {
      CGImageRef logo = drawCenteredSquare(extracted, bbox, (size_t)logoSize, 0.10, NULL);
      if (!writePNG(logo, logoPNG, &err)) die([NSString stringWithFormat:@"Failed to write PNG: %@", err.localizedDescription]);
      writeSVGEmbedPNG(logoPNG, (size_t)logoSize, logoSVG, &err);
      writePDF(logo, (size_t)logoSize, logoPDF);
      CGImageRelease(logo);
    }

    // Ribbon-only (transparent) export for in-app usage.
    // This avoids scaling the full navy square when we just need the mark.
    // Always derived from the same source image to keep it consistent.
    {
      size_t sw = CGImageGetWidth(srcSquare);
      size_t sh = CGImageGetHeight(srcSquare);
      uint8_t *markData = NULL;
      CGContextRef markCtx = makeRGBAContext(sw, sh, &markData);
      if (!markCtx) die(@"Failed to allocate mark context");

      CGContextSaveGState(markCtx);
      CGContextTranslateCTM(markCtx, 0, (CGFloat)sh);
      CGContextScaleCTM(markCtx, 1, -1);
      CGContextDrawImage(markCtx, CGRectMake(0, 0, sw, sh), srcSquare);
      CGContextRestoreGState(markCtx);

      sampleBackground(markData, sw, sh, sw * 4, &br, &bg, &bb);
      applyChromaMatte(markData, sw, sh, sw * 4, br, bg, bb, matteLow, matteHigh);
      decontaminateEdges(markData, sw, sh, sw * 4, br, bg, bb);

      CGImageRef markExtracted = CGBitmapContextCreateImage(markCtx);
      CGRect markBox;
      if (alphaBoundingBox(markData, sw, sh, sw * 4, 10, &markBox)) {
        CGImageRef markOut = drawCenteredSquare(markExtracted, markBox, (size_t)logoSize, 0.16, NULL);
        NSString *markPNG = [outLogo stringByAppendingPathComponent:@"dkf-ribbon-k-ribbon-only.png"];
        NSString *markSVG = [outLogo stringByAppendingPathComponent:@"dkf-ribbon-k-ribbon-only.svg"];
        writePNG(markOut, markPNG, NULL);
        writeSVGEmbedPNG(markPNG, (size_t)logoSize, markSVG, NULL);
        CGImageRelease(markOut);
      }

      CGImageRelease(markExtracted);
      CGContextRelease(markCtx);
      free(markData);
    }

    // App icon base (1024): full navy background, no transparency in keep-background mode.
    CGImageRef icon = resize(srcSquare, (size_t)iconSize, (size_t)iconSize);
    if (!icon) die(@"Failed to render app icon base");

    NSString *appIconSet = [outAppIcon stringByAppendingPathComponent:@"DKF.appiconset"];
    if (!ensureDir(appIconSet, &err)) die([NSString stringWithFormat:@"Failed to create %@: %@", appIconSet, err.localizedDescription]);

    struct { const char *name; int px; } sizes[] = {
      {"AppIcon-20@1x.png", 20},
      {"AppIcon-20@2x.png", 40},
      {"AppIcon-20@3x.png", 60},
      {"AppIcon-29@1x.png", 29},
      {"AppIcon-29@2x.png", 58},
      {"AppIcon-29@3x.png", 87},
      {"AppIcon-40@1x.png", 40},
      {"AppIcon-40@2x.png", 80},
      {"AppIcon-40@3x.png", 120},
      {"AppIcon-60@2x.png", 120},
      {"AppIcon-60@3x.png", 180},
      {"AppIcon-76@1x.png", 76},
      {"AppIcon-76@2x.png", 152},
      {"AppIcon-83.5@2x.png", 167},
      {"AppIcon-1024.png", 1024},
    };

    for (size_t i = 0; i < sizeof(sizes) / sizeof(sizes[0]); i++) {
      CGImageRef r = resize(icon, (size_t)sizes[i].px, (size_t)sizes[i].px);
      NSString *p = [appIconSet stringByAppendingPathComponent:[NSString stringWithUTF8String:sizes[i].name]];
      if (!writePNG(r, p, &err)) die([NSString stringWithFormat:@"Failed to write %@: %@", p, err.localizedDescription]);
      CGImageRelease(r);
    }

    NSString *contents = [appIconSet stringByAppendingPathComponent:@"Contents.json"];
    if (![contentsJSON() writeToFile:contents atomically:YES encoding:NSUTF8StringEncoding error:&err]) {
      die([NSString stringWithFormat:@"Failed to write Contents.json: %@", err.localizedDescription]);
    }

    NSString *preview = [outAppIcon stringByAppendingPathComponent:@"dkf-appicon-1024.png"];
    writePNG(icon, preview, NULL);

    CGImageRelease(icon);
    CGImageRelease(srcSquare);
    if (extracted) CGImageRelease(extracted);
    if (ctx) CGContextRelease(ctx);
    if (data) free(data);
    CGImageRelease(src);

    printf("✅ Generated:\n");
    printf("- %s\n", logoPNG.UTF8String);
    printf("- %s\n", [[outLogo stringByAppendingPathComponent:@"dkf-ribbon-k.svg"] UTF8String]);
    printf("- %s\n", [[outLogo stringByAppendingPathComponent:@"dkf-ribbon-k.pdf"] UTF8String]);
    printf("- %s\n", preview.UTF8String);
    printf("- %s/\n", appIconSet.UTF8String);
  }
  return 0;
}
