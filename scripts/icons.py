"""Create app-owned PWA icons without external image assets."""
import pathlib, struct, zlib
out=pathlib.Path(__file__).resolve().parent.parent/'frontend'/'public'
out.mkdir(parents=True,exist_ok=True)
for size in (192,512):
    rows=[]
    for y in range(size):
        row=bytearray()
        for x in range(size):
            u,v=x/size,y/size
            wallet=.23<u<.77 and .33<v<.69
            flap=.57<u<.81 and .43<v<.59
            dot=(u-.65)**2+(v-.51)**2<.012**2
            color=(22,63,53) if not wallet else (220,241,164)
            if flap: color=(124,158,104)
            if dot: color=(22,63,53)
            row.extend(color)
        rows.append(b'\0'+row)
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    (out/f'icon-{size}.png').write_bytes(png)
