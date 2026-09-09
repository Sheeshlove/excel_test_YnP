#!/usr/bin/env python3
"""Рисует иконку приложения (PNG 1024×1024) без внешних зависимостей."""
import zlib, struct, math, sys, os

S = 1024
SS = 2                      # суперсэмплинг для сглаживания
W = S * SS

NAVY_TOP = (15, 37, 64)
NAVY_BOT = (27, 58, 95)
WHITE = (255, 255, 255)
LINE = (214, 222, 233)
HEAD = (223, 231, 243)
GOLD = (201, 154, 46)
BLUE = (10, 108, 255)


def rounded(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def build():
    buf = bytearray(W * W * 4)
    pad = int(W * 0.055)
    r_out = int(W * 0.22)
    # внутренний «лист»
    ix0, iy0 = int(W * 0.17), int(W * 0.20)
    ix1, iy1 = W - ix0, W - int(W * 0.17)
    r_in = int(W * 0.035)
    rows, cols = 5, 4
    ch = (iy1 - iy0) / rows
    cw = (ix1 - ix0) / cols
    lw = max(1, int(W * 0.006))

    for y in range(W):
        t = y / W
        base = tuple(int(NAVY_TOP[i] + (NAVY_BOT[i] - NAVY_TOP[i]) * t) for i in range(3))
        row = y * W * 4
        for x in range(W):
            o = row + x * 4
            if not rounded(x, y, pad, pad, W - pad, W - pad, r_out):
                continue
            cr, cg, cb = base
            if rounded(x, y, ix0, iy0, ix1, iy1, r_in):
                col = int((x - ix0) // cw)
                rw = int((y - iy0) // ch)
                cr, cg, cb = WHITE
                if rw == 0:
                    cr, cg, cb = HEAD
                elif rw == 2 and col == 1:
                    cr, cg, cb = (232, 241, 255)
                elif rw == 3 and col == 3:
                    cr, cg, cb = (250, 240, 214)
                # линии сетки
                fx = (x - ix0) % cw
                fy = (y - iy0) % ch
                if fx < lw or fy < lw:
                    cr, cg, cb = LINE
                # акцентная рамка на «выделенной» ячейке
                if rw == 2 and col == 1:
                    ex, ey = (x - ix0) - col * cw, (y - iy0) - rw * ch
                    if ex < lw * 2 or ey < lw * 2 or ex > cw - lw * 2 or ey > ch - lw * 2:
                        cr, cg, cb = BLUE
                if rw == 3 and col == 3:
                    ex, ey = (x - ix0) - col * cw, (y - iy0) - rw * ch
                    if ex < lw * 2 or ey < lw * 2 or ex > cw - lw * 2 or ey > ch - lw * 2:
                        cr, cg, cb = GOLD
            buf[o] = cr; buf[o + 1] = cg; buf[o + 2] = cb; buf[o + 3] = 255
    return buf


def downsample(buf):
    out = bytearray(S * S * 4)
    for y in range(S):
        for x in range(S):
            r = g = b = a = 0
            for dy in range(SS):
                for dx in range(SS):
                    o = ((y * SS + dy) * W + (x * SS + dx)) * 4
                    r += buf[o]; g += buf[o + 1]; b += buf[o + 2]; a += buf[o + 3]
            n = SS * SS
            o2 = (y * S + x) * 4
            out[o2] = r // n; out[o2 + 1] = g // n; out[o2 + 2] = b // n; out[o2 + 3] = a // n
    return out


def write_png(path, data, size):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw += data[y * size * 4:(y + 1) * size * 4]
    def chunk(tag, payload):
        c = struct.pack('>I', len(payload)) + tag + payload
        return c + struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'icon.png')
    write_png(out, downsample(build()), S)
    print('иконка записана:', out, os.path.getsize(out), 'байт')
