extends RefCounted
# MessagePack (o formato que o servidor Colyseus usa nas mensagens). Só o que o jogo precisa: números, textos,
# listas, dicionários, true/false/null e bytes.

static func codificar(v) -> PackedByteArray:
	var b := StreamPeerBuffer.new()
	b.big_endian = true
	_cod(b, v)
	return b.data_array

static func _cod(b: StreamPeerBuffer, v) -> void:
	match typeof(v):
		TYPE_NIL:
			b.put_u8(0xc0)
		TYPE_BOOL:
			b.put_u8(0xc3 if v else 0xc2)
		TYPE_INT:
			var n: int = v
			if n >= 0 and n < 128:
				b.put_u8(n)
			elif n < 0 and n >= -32:
				b.put_u8(n & 0xff)
			elif n >= 0 and n < 256:
				b.put_u8(0xcc); b.put_u8(n)
			elif n >= 0 and n < 65536:
				b.put_u8(0xcd); b.put_u16(n)
			elif n >= 0 and n < 4294967296:
				b.put_u8(0xce); b.put_u32(n)
			elif n >= -128 and n < 0:
				b.put_u8(0xd0); b.put_8(n)
			elif n >= -32768 and n < 0:
				b.put_u8(0xd1); b.put_16(n)
			elif n >= -2147483648 and n < 0:
				b.put_u8(0xd2); b.put_32(n)
			else:
				b.put_u8(0xd3); b.put_64(n)
		TYPE_FLOAT:
			var f: float = v
			if f == floor(f) and abs(f) < 2147483648.0:
				_cod(b, int(f)) # número redondo vai como inteiro (menor)
			else:
				b.put_u8(0xcb); b.put_double(f)
		TYPE_STRING, TYPE_STRING_NAME:
			var t: PackedByteArray = String(v).to_utf8_buffer()
			var n := t.size()
			if n < 32:
				b.put_u8(0xa0 | n)
			elif n < 256:
				b.put_u8(0xd9); b.put_u8(n)
			elif n < 65536:
				b.put_u8(0xda); b.put_u16(n)
			else:
				b.put_u8(0xdb); b.put_u32(n)
			b.put_data(t)
		TYPE_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_STRING_ARRAY:
			var n: int = v.size()
			if n < 16:
				b.put_u8(0x90 | n)
			elif n < 65536:
				b.put_u8(0xdc); b.put_u16(n)
			else:
				b.put_u8(0xdd); b.put_u32(n)
			for x in v:
				_cod(b, x)
		TYPE_DICTIONARY:
			var n: int = v.size()
			if n < 16:
				b.put_u8(0x80 | n)
			elif n < 65536:
				b.put_u8(0xde); b.put_u16(n)
			else:
				b.put_u8(0xdf); b.put_u32(n)
			for k in v:
				_cod(b, str(k))
				_cod(b, v[k])
		TYPE_PACKED_BYTE_ARRAY:
			var n: int = v.size()
			if n < 256:
				b.put_u8(0xc4); b.put_u8(n)
			elif n < 65536:
				b.put_u8(0xc5); b.put_u16(n)
			else:
				b.put_u8(0xc6); b.put_u32(n)
			b.put_data(v)
		TYPE_VECTOR3:
			_cod(b, [v.x, v.y, v.z])
		_:
			_cod(b, str(v))

# Lê um valor a partir da posição atual do buffer (b.big_endian precisa estar ligado)
static func ler(b: StreamPeerBuffer):
	var c: int = b.get_u8()
	if c < 0x80:
		return c
	if c >= 0xe0:
		return c - 256
	if c >= 0xa0 and c < 0xc0:
		return _texto(b, c & 0x1f)
	if c >= 0x90 and c < 0xa0:
		return _lista(b, c & 0x0f)
	if c >= 0x80 and c < 0x90:
		return _mapa(b, c & 0x0f)
	match c:
		0xc0: return null
		0xc2: return false
		0xc3: return true
		0xc4: return _bytes(b, b.get_u8())
		0xc5: return _bytes(b, b.get_u16())
		0xc6: return _bytes(b, b.get_u32())
		0xc7: return _ext(b, b.get_u8())
		0xc8: return _ext(b, b.get_u16())
		0xc9: return _ext(b, b.get_u32())
		0xca: return b.get_float()
		0xcb: return b.get_double()
		0xcc: return b.get_u8()
		0xcd: return b.get_u16()
		0xce: return b.get_u32()
		0xcf: return b.get_u64()
		0xd0: return b.get_8()
		0xd1: return b.get_16()
		0xd2: return b.get_32()
		0xd3: return b.get_64()
		0xd4: return _ext(b, 1)
		0xd5: return _ext(b, 2)
		0xd6: return _ext(b, 4)
		0xd7: return _ext(b, 8)
		0xd8: return _ext(b, 16)
		0xd9: return _texto(b, b.get_u8())
		0xda: return _texto(b, b.get_u16())
		0xdb: return _texto(b, b.get_u32())
		0xdc: return _lista(b, b.get_u16())
		0xdd: return _lista(b, b.get_u32())
		0xde: return _mapa(b, b.get_u16())
		0xdf: return _mapa(b, b.get_u32())
	return null

static func _texto(b: StreamPeerBuffer, n: int) -> String:
	if n == 0:
		return ""
	return (b.get_data(n)[1] as PackedByteArray).get_string_from_utf8()

static func _bytes(b: StreamPeerBuffer, n: int) -> PackedByteArray:
	if n == 0:
		return PackedByteArray()
	return b.get_data(n)[1]

static func _ext(b: StreamPeerBuffer, n: int):
	b.get_8() # tipo da extensão (o jogo não usa)
	if n > 0:
		b.get_data(n)
	return null

static func _lista(b: StreamPeerBuffer, n: int) -> Array:
	var a := []
	a.resize(n)
	for i in n:
		a[i] = ler(b)
	return a

static func _mapa(b: StreamPeerBuffer, n: int) -> Dictionary:
	var d := {}
	for i in n:
		var k = ler(b)
		d[k] = ler(b)
	return d
