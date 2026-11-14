extends SceneTree
# Frases montadas em inglês (godot-prototipo/idioma.gd), sem o jogo inteiro.
# Rodar: godot --headless --path godot-prototipo --script ../ferramentas/testes/idioma-godot.gd

const Idioma = preload("res://idioma.gd")

func _init() -> void:
	Idioma.iniciar()
	Idioma.trocar("en")
	var casos := {
		"Mochila": "Inventory",
		"Nível 7": "Level 7",
		"Nível 12! +5 pontos de atributo": "Level 12! +5 attribute points",
		"Apagar Ruiva?": "Delete Ruiva?",
		"Tem 2 peças na mochila para este lugar": "2 pieces in your inventory for this slot",
		"Missão cumprida: Ruiva": "Quest complete: Ruiva",
		"Durabilidade 40/50 · conserto 12 ouro": "Durability 40/50 · repair 12 gold",
		"Você está perto da Fornalha e da Bigorna: aqui fica tudo o que elas fazem. Os outros submenus mostram o resto.":
			"You're near the Furnace and the Anvil: here's everything they make. The other tabs show the rest.",
		"Destruir 3 peças Raras da mochila?\nPeças com cadeado e as do corpo ficam.":
			"Destroy 3 Rare pieces from your inventory?\nLocked and equipped pieces are kept.",
		"Derrube Puglins na Clareira dos Puglins 3/6": "Take down Puglins in Puglin Glade 3/6",
		"Vendeu 3 Lenha por 12 de ouro": "Sold 3 Firewood for 12 gold",
		"Pack entregue! +40 de ouro (veio de navio!)": "Pack delivered! +40 gold (came by ship!)",
		"Tô precisando de Cenoura. Se você me arrumar, fico te devendo uma.": "I need Carrot. If you can get me some, I owe you one.",
		"Ninguém lembra de onde você veio. Nem você.": "No one remembers where you came from. Not even you.",
		"Sem combustível! Toque no carrinho e abasteça.": "Out of fuel! Tap the cart to refuel.",
		"Para 16 lugares:\n5 Lenha, 2 Barra de ferro": "For 16 slots:\n5 Firewood, 2 Iron Bar",
		"Rosa compra o que você tiver: na Mochila, toque no item e em Vender. A banca dela também é a do Alfaiate (Profissões → Alfaiate).":
			"Rosa buys whatever you have: in your Inventory, tap the item and then Sell. Her stall is also the Tailor's (Professions → Tailor).",
		"Uma frase nova de teste e sem tradução": "Uma frase nova de teste e sem tradução", # modelo curto ("%s e %s", "%d de %s") não pica a frase
		"Ruiva": "Ruiva",
		"12": "12",
	}
	var bons := 0
	var falhas := 0
	for pt in casos:
		var en := Idioma.frase(pt)
		if en == casos[pt]:
			bons += 1
		else:
			falhas += 1
			print("FALHOU: ", pt.replace("\n", " | "), " => ", en.replace("\n", " | "))
	Idioma.trocar("pt")
	if Idioma.frase("Mochila") == "Mochila" and TranslationServer.translate("Mochila") == "Mochila":
		bons += 1
	else:
		falhas += 1
		print("FALHOU: voltar para Português")
	Idioma.trocar("pt")
	print("idioma: %d ok, %d falhas" % [bons, falhas])
	quit()
