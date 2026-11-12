extends Node3D
# Vila da Clareira em Godot: mesma vila, mesmos personagens anime e as mesmas habilidades do jogo HTML (que fica de backup).
# Por enquanto tudo roda no aparelho (modo solo); o servidor Colyseus entra depois.

const D = preload("res://dados.gd")
const MundoTerreno = preload("res://mundo_terreno.gd") # FASE 3: continentes e mar
const Hud = preload("res://hud.gd")
const Efeitos = preload("res://efeitos.gd")
const BossMundo = preload("res://boss_mundo.gd")
const LodMalha = preload("res://lod_malha.gd") # LOD para roupa, cabelo e corpo montados no jogo (NPCs e outros jogadores)
const Terreno = preload("res://terreno.gd")
const Relevo = preload("res://relevo.gd")
const Grafico = preload("res://grafico.gd")
const Mato = preload("res://mato.gd") # mato alto perto do herói (André 2026-11-10)
const Submerso = preload("res://submerso.gd")
const Caverna = preload("res://caverna.gd")
const Andar = preload("res://andar.gd")
const Online = preload("res://online.gd")
const Progresso = preload("res://progresso.gd")
const Menu = preload("res://menu.gd")
const BracoEspada = preload("res://braco_espada.gd")
const MaoFechada = preload("res://mao_fechada.gd")
const Armas = preload("res://armas.gd")
const AnimHeroi = preload("res://anim_heroi.gd")
const CameraHeroi = preload("res://camera_heroi.gd")
const Sons = preload("res://sons.gd")
const Musica = preload("res://musica.gd")
const Inclinar = preload("res://inclinar.gd")
const Encostar = preload("res://encostar.gd") # escalando, corpo, mãos e pés encostam na pedra (André 2026-11-07)
const AguaFx = preload("res://agua_fx.gd")
const Armadura = preload("res://armadura.gd")
const Aparencia = preload("res://aparencia.gd")
const VisualNpc = preload("res://visual_npc.gd")
const Criador = preload("res://criador.gd")
const Trabalho = preload("res://trabalho.gd")
const Pesca = preload("res://pesca.gd")
const Transporte = preload("res://transporte.gd") # FASE 1: packs e transportes do Quimera
const Cenario = preload("res://cenario.gd") # ruínas, rochedos, troncos caídos e mato da mata (2026-11-03)
var cenario # cenario.gd
const VilasMundo = preload("res://vilas_mundo.gd") # as mini vilas do mundo grande (história v2, Entrega 3)
var vilas_mundo # vilas_mundo.gd
const MenuTopo = preload("res://menu_topo.gd")
const Combate = preload("res://combate.gd")
const Conversa = preload("res://conversa.gd")
const Troca = preload("res://troca.gd")
const LeilaoUi = preload("res://leilao_ui.gd") # Casa do Comércio: o leilão do Otávio no Rio Claro (história v2, Entrega 3)
const Reforco = preload("res://reforco.gd")
const Festa = preload("res://festa.gd")
const Amigos = preload("res://amigos.gd")
const Chat = preload("res://chat.gd")
const Minimapa = preload("res://minimapa.gd")
const VoltaVila = preload("res://volta_vila.gd")
const Totem = preload("res://totem.gd") # totens de teleporte (André 2026-11-10)
const MissaoAtiva = preload("res://missao_ativa.gd") # missão ativa no canto esquerdo com "Ir para" (André 2026-11-11)
const Cinematica = preload("res://cinematica.gd") # cenas da história com a câmera do jogo (André 2026-11-11)
const Nevoa = preload("res://nevoa.gd") # névoa das zonas ainda fechadas (progressão até o Nv 100, André 2026-11-10)
const Rota = preload("res://rota.gd")
const Construcao = preload("res://construcao.gd")
const EditarHud = preload("res://editar_hud.gd")
const RetratoHeroi = preload("res://retrato_heroi.gd")
const Montaria = preload("res://montaria.gd")
const Morte = preload("res://morte.gd") # sensação de morrer: vida baixa (vermelho, coração) e a tela de queda

const RAIO := 34.0
const RESOLUCAO_PADRAO := 0.6 # mesma nitidez do site (1.75x numa tela de ~904 pontos de largura)
const LACOS := ["parada", "parada_solta", "parada_solta_m", "andar", "trote", "corrida", "lado_e_andar", "lado_d_andar", "tras_andar", "lado_e_correr", "lado_d_correr", "tras_correr", "espada_parada", "cajado_parada", "queda", "parede_agarrado", "parede_beirada", "parede_balanca", "nadar", "boiar", "sentado_chao"]

# inimigos: monstros do Bestiário (modelos/puglin.glb e imp.glb), nunca dentro da vila. Os do acampamento do leste
# saíram (pedido do André 2026-11-02): agora ficam no campo de caça lá fora (mundo.caca, regra do Quimera, veja passo_cacas)
const BANDO := []
const NOME_TIPO := {"puglin": "Puglin", "imp": "Imp", "chefe": "Imp Chefe", "lobo": "Lobo", "golem": "Golem de Magma", "maw": "Maw", "warrok": "Warrok", "tita": "Titã", "dragao": "Dragão"}
# o lobo (modelos/lobo.glb, feito por IA) era montaria de teste e virou bicho de caça (pedido do André 2026-11-03)
const MODELO_TIPO := {"puglin": "puglin", "imp": "imp", "chefe": "imp", "lobo": "lobo", "golem": "pumpkinhulk", "maw": "maw", "warrok": "warrok", "tita": "tita", "dragao": "dragao"}
# NPCs: lugar e função vêm do servidor (dados/mundo.json); aqui só o modelo de cada um
const MODELO_NPC := {"lider": "fumiriya", "curandeira": "shino", "comerciante": "vivi", "andarilho": "vita", "ferreiro": "cabelo_m", "reset": "cabelo_m",
	"m_lenha": "cabelo_m", "m_pedra": "cabelo_m", "m_metal": "cabelo_m", "m_horta": "vivi", "m_peixe": "cabelo_m", "m_couro": "cabelo_m", # mercadores de pack (FASE 1)
	"m_conserva": "vivi", "m_abobora": "cabelo_m", "m_perola": "vivi", "m_ervas": "cabelo_m", "m_obsid": "cabelo_m", "m_brasa": "vivi", # e os do mundo grande (FASE 3)
	"alquimista": "shibu"} # Mirela, a alquimista (André 2026-11-09)
# NPCs pintados com a "tinta" de shared/dados.js (cabelo, roupa, calça e tamanho). O Tomás virou homem (pedido do André,
# 2026-11-03): base masculina com roupa de couro marrom, mais alto, para não ficar igual ao Mestre Ivo
# O Aldo virou o ancião da vila (pedido do André, 2026-11-05): cabelo grisalho da tinta dele
const TINGIR_NPC := ["ferreiro", "lider", "m_lenha", "m_pedra", "m_metal", "m_horta", "m_peixe", "m_couro", "m_conserva", "m_abobora", "m_perola", "m_ervas", "m_obsid", "m_brasa", "alquimista"]
const VIDA_INIMIGO := {"puglin": 80.0, "imp": 110.0, "chefe": 220.0, "lobo": 95.0, "golem": 130.0, "maw": 140.0, "warrok": 260.0, "tita": 260.0, "dragao": 260.0} # TIPOS_INIMIGO de shared/dados.js
# monstros longe do herói (outra clareira): não desenha, não anima e (sem internet) não pensa
const LONGE_INIMIGO := 70.0
const NOME_LONGE := 30.0
# corpos que vêm do VRoid de casaco/moletom com capuz: a blusa vira camisa de linho justa (visual_npc.tirar_casaco)
const SEM_CASACO := ["cabelo_m"]
const EXTRAS := ["shibu", "shibu_sombrio", "cabelo_m", "fumiriya", "shino", "vivi", "vita", "victoria", "cabelo_m", "fumiriya"]

var sol: DirectionalLight3D
var camera: Camera3D
var grama: MultiMeshInstance3D
var mato # mato.gd: capim alto e samambaia perto do herói
var hud
var fx
var boss_mundo # boss_mundo.gd: bosses de mundo (André 2026-11-11): aviso no chão, barra no topo, efeitos no herói
var morte # morte.gd: bordas vermelhas, coração e cor sumindo com a vida baixa; "VOCÊ CAIU" e o escuro ao morrer
var combate # combate.gd: aviso antes do golpe do monstro, tranco, firme, esquiva, morte em fumaça
var _lenta_ate := 0.0 # câmera lenta (só o tempo): esquiva e último inimigo
var _lenta_k := 1.0
var cache := {}
var armas_lugar := {} # por personagem: onde a espada e o cajado ficam presos (cada corpo tem a mão num jeito)
var mundo: Dictionary # dados/mundo.json: pedras, casas e regras de escalada (iguais às do servidor)
var terreno
var relevo # relevo.gd: montanha e lagos (desenho)
var leve # visual_leve.gd: Sombras "Leves" e cor da grama "Natural" (Configurações, André 2026-11-10)
var grafico # grafico.gd: qualidade gráfica Baixa/Média/Alta (Configurações; a primeira vez escolhe pelo celular)
var dia # dia_noite.gd: dia e noite do Quimera (relógio da conta, céu, luz e o sono na cama)
var caverna # caverna.gd: a Caverna da Montanha (primeira dungeon), desenhada aos poucos quando o herói chega perto
var cavernas_mundo: Array = [] # caverna.gd das cavernas do mundo grande (Parte 8)
# o quanto o herói está no escuro de alguma caverna (0 fora): quem manda na luz lá dentro é a caverna.gd
func escuro_caverna() -> float:
	var e: float = float(caverna.escuro) if caverna != null else 0.0
	for c in cavernas_mundo:
		e = maxf(e, float(c.escuro))
	return e
var mov # andar.gd: como o herói anda, colide e escala
var _clip_visto := -1
var online # online.gd: servidor do Oracle (login, outros jogadores, dano de verdade)
var mascara: Image
var vila_no: Node3D # a vila (vila.glb): de onde sai a pedra dos veios
var trabalho # trabalho.gd: estamina, veios, coleta e criação (Parte 3 do Quimera)
var transporte # transporte.gd: packs, carrinho, barquinho e navio mercante (FASE 1, cópia do Quimera)
var pesca # pesca.gd: pescaria igual à do Quimera (André 2026-11-08): botão Pescar, vara, boia, linha e a briga

# ---------- herói ----------
var heroi: Node3D
var expressao: Expressao # rosto no combate: olhos semicerrados no dano, olhar firme no combo (expressao.gd)
var heroi_anim # anim_heroi.gd: AnimationTree com locomoção misturada e ações por cima (mesma cara do AnimationPlayer)
var heroi_esq: Skeleton3D
var espada: Node3D
var cajado: Node3D
var mao_direita := -1
var mao_esquerda := -1
var h := {"vida": 120.0, "mana": 100.0, "vy": 0.0, "pulos": 0, "morto": 0.0, "modo": "Espada", "combo": 0, "combo_ate": 0.0,
	"dash": 0.0, "dash_dir": Vector3.ZERO, "segurando": false, "ultimo_basico": 0.0, "escudo": 0.0, "escudo_ate": 0.0,
	"combo_fim": -9.0, "mao": 0, "pend": null, "lunge": null, "sem_alvo": -9.0, "vel_k": 1.0, "golpe_forte": false,
	"alvo_fixo": null, "mira_ate": -9.0, "mira_espada": null} # alvo_fixo: monstro travado do mago (alvo_travado)
# mira_espada: o bicho do último corte da espada (o corpo continua virado para ele até mira_ate, andando de lado)
# mira_ate: até quando o mago continua virado para o alvo depois do último tiro da Faísca (anda de lado e de costas)
var acao := {} # o que o herói está fazendo agora (golpe, habilidade, rolamento...)
var recargas := {} # nome -> segundos que faltam
var P # progresso.gd: nível, atributos, skills e os 6 botões
var menu # menu.gd: menu do personagem (toque na barra de vida)
var conversa # conversa.gd: botão Falar e janela do NPC (tocar no NPC vai até ele)
var troca # troca.gd: troca entre jogadores com cadeado (tocar noutro jogador, só online)
var leilao # leilao_ui.gd: a janela da Casa do Comércio (só online)
var reforco # reforco.gd: janelinha do reforço de equipamento (igual ao Quimera)
var festa # festa.gd: comemoração de nível, missão, liberado, reforço e evoluir (faixa, faíscas, coluna de luz, som)
var chat # chat.gd: chat geral e de amigos (só online; o geral pode ser silenciado)
var amigos # amigos.gd: lista de amigos (até 20) e time com barras de vida e mana (só online)
var volta # volta_vila.gd: casinha do menu do topo (Voltar para a vila) e o lugar onde o herói estava ao sair
var totem # totem.gd: totens de teleporte (descobrir, viajar pagando, área segura, renascer)
var missao_ativa # missao_ativa.gd: a missão da vez à esquerda, embaixo do time; tocar dá "Ir para" (autopath)
var cinematica # cinematica.gd: cena da história (faixas de cinema, câmera andando, legenda, Pular)
var nevoa # nevoa.gd: zonas que a missão principal ainda não abriu (parede de névoa, o herói para na borda)
var menu_topo # menu_topo.gd: Conta, Multijogador e Configurações no canto de cima, recolhe na seta (como o Quimera)
var rota # rota.gd: "Ir para" do mapa, o herói vai sozinho pela estrada (o joystick cancela)
var minimapa # minimapa.gd: minimapa no canto de cima à direita; tocar abre o mapa completo
var construcao # construcao.gd: Vila dos Lotes (comprar lote, modo construção e horta, como no Quimera)
var editar_hud # editar_hud.gd: segurar o painel de vida e mana abre o modo de editar a interface
var retrato_heroi # retrato_heroi.gd: rosto do herói no painel
var vibracao := true # Configurações: vibrar no golpe e no dano
var criador # criador.gd: criador de personagem (conta nova e botão Aparência do menu)
var aparencia := {} # cores, altura e rosto do herói (a base é sempre a Ruiva)
var visual := "ruiva" # corpo do herói (criador: a Ruiva e o cabelo_m, CRIADOR.corpos)
const ARQUIVO_APARENCIA := "user://aparencia.cfg" # última aparência (para jogar sem internet)
var tempo := 0.0

# ---------- outros ----------
var inimigos: Array = []
# FPS (varredura 2026-11-10): os monstros a menos de LONGE_INIMIGO do herói, refeita todo quadro em lod_inimigos. O mundo
# grande tem ~400 monstros; as contas de todo quadro que só valem de perto (barras e nomes, quem empurra o herói) olham
# só esta lista em vez de passar pelos 400.
var inimigos_perto: Array = []
var npcs: Array = []
var extras: Array = []

var cam # camera_heroi.gd: segue com mola, vai para as costas correndo, treme no golpe
var braco # braco_espada.gd: espada baixa e para trás ao andar e correr no modo espada
var mao_fechada # mao_fechada.gd: dedos fechados em volta do cajado na mão
var inclinar # inclinar.gd: tronco inclina na curva e o quadril afunda no pouso
var encostar # encostar.gd: escalando, mãos e pés na pedra; _encosta = m que o desenho do herói vai para a frente
var _encosta := 0.0
var _encosta_giro := 0.0 # rad: o corpo fica de frente para a face da pedra
var sons # sons.gd
var musica # musica.gd: música de fundo em loop (volume em Configurações > Música)
var montaria = null # montaria.gd: montado no lobo (botão do lobo); null = a pé
# sensação do combate (ajuste aqui testando no celular)
const FILA_TEMPO := 0.3 # s que um botão apertado na hora errada fica guardado esperando poder sair
const FILA_PULO := 0.15 # o pulo apertado pouco antes de pousar sai no pouso
const HITSTOP := 0.05 # s de congelada no golpe que acerta
const HITSTOP_FORTE := 0.085 # 4º golpe do combo, skill e crítico
const TREME := 0.15 # André 2026-11-02: pouca mudança de câmera no combate (era 0,22)
const TREME_FORTE := 0.38
var fila = null # botão guardado: {q, ate}
var _hitstop_ate := 0.0
var _impacto_quadro := -1
var _passo_dist := 0.0 # metros andados desde o último som de passo
var _quadril := 0.0 # afundada do quadril no pouso (m)
# Nado nos lagos fundos (André 2026-11-06): boiando o herói nada (anim_heroi.gd), as armas vão para as costas e não
# dá para lutar. O corpo sobe um pouco para a cabeça e as costas ficarem fora da água (o Mixamo nada mais baixo).
var _nadando := false
var agua_fx # agua_fx.gd: espuma em volta, rastro em V e respingo das braçadas
# cajado nas costas nadando (direção de arte 2026-11-06): deitado, a chama passava da cabeça como uma lança; desliza
# CAJADO_NADO m para os pés (a chama fica na nuca). Boiando de pé fica no lugar.
const CAJADO_NADO := 0.35
var _caj_base = null # posição do cajado nas costas (no osso), guardada ao prender
var _saindo_agua := 0.0 # segundos que faltam da saída do lago (do nado até ficar de pé)
var _sobe_agua := 0.0 # metros que o corpo sobe agora
# André 2026-11-06 (2ª): estava alto demais (peito todo fora). Agora só cabeça e ombros saem da água
const SOBE_BOIANDO := -0.18 # boiando parado (Treading Water): a água no ombro
const SOBE_NADANDO := 0.32 # nadando (Swimming): cabeça e nuca fora, as costas rente à água
const SAIR_AGUA_RITMO := 1.15
# molas do peso do corpo (corpo_vivo): ângulo e velocidade do tronco para a frente e para o lado
const MOLA_K := 110.0 # força da mola (maior = volta mais rápido)
const MOLA_AMORT := 10.0 # amortecimento (menor = balança mais vezes; 10 dá um tranco e meio)
var _frente := 0.0
var _frente_v := 0.0
var _incl := 0.0
var _incl_v := 0.0
var _vel_ant := 0.0
var _dir_joy := Vector2.ZERO # para onde o joystick aponta agora (a cabeça vira antes do corpo)
var _olhar := 0.0
var _forca_joy := 0.0
# arrancada (pernas da animação própria, anim_heroi.gd): ritmo da animação e até onde ela vai antes de virar corrida
const ARR_RITMO := 1.6 # a animação do Mixamo sai devagar (trote); 1,6x acompanha a rampa de ~0,5 s até a corrida
const ARR_FIM := 1.05 # s da animação: depois disso as pernas voltam para a corrida normal
var _cansaco := 0.0 # 0 a 1: sobe correndo, desce parado; parado, o peito respira mais forte e mais rápido
var _respira := 0.0 # fase da respiração
var _resp_peso := 0.0 # respiração só aparece parado (entra e sai aos poucos)
var _acel := 0.0 # aceleração no chão (m/s², suavizada): + arrancando, - freando
var _flash := {} # Node3D do inimigo -> {mat, t}

# teste de desempenho
var etapas := []
var etapa := -1
var t_etapa := 0.0
var quadros := 0
var soma_proc := 0.0
# FPS (2026-11-10): o Teste também mede a placa de vídeo (tempo que a GPU leva para desenhar o quadro) e o tempo do
# processador para mandar desenhar. Assim dá para ver no celular quem segura o FPS: o jogo (CPU) ou a placa (GPU).
var soma_gpu := 0.0
var soma_rcpu := 0.0
var resultados := []
# FPS (auditoria 2026-11-11): o "jogo" (TIME_PROCESS) é o PIOR quadro do último segundo e ainda inclui a espera da tela,
# por isso dava 60-80 ms com o jogo a 40 FPS. Agora o quadro é medido por partes, com os sinais do motor:
# física (passos de física), lógica (scripts, animações, ossos), desenho (mandar desenhar e esperar a tela) e o resto
# (o limite de FPS segurando). Média dos últimos quadros, sempre ligada (são 4 relógios por quadro).
var _q_fis := 0
var _q_proc := 0
var _q_pre := 0
var _q_fim := 0
var q_ms := {"quadro": 0.0, "fisica": 0.0, "logica": 0.0, "desenho": 0.0, "espera": 0.0}
var soma_q := {}
var _sem_gente := [] # etapa "Sem personagens": [nó, estava visível]
var _desligados_teste := [] # etapas "Sem interface", "Herói sem animação", "Sem monstros": [objeto, propriedade, valor de antes]
var _tela_teste: CanvasLayer
var _rotulo_t := 0.0
var ms_main := 0.0 # tempo do _process do main por quadro (média), aparece no Teste
var rotulo: Label
var botao_teste: Button
const ESPERA := 2.5
const MEDE := 5.0

func _ready() -> void:
	get_viewport().scaling_3d_scale = RESOLUCAO_PADRAO
	grafico = Grafico.new(self) # primeiro: tudo que entra na cena daqui em diante recebe o alcance do nível escolhido
	add_child(grafico)
	# desenho em paralelo (APK 2026-11-12): rodou uns segundos sem cair, a escolha do jogador volta a valer (grafico.gd)
	get_tree().create_timer(Grafico.PARALELO_OK).timeout.connect(func():
		if is_instance_valid(grafico):
			grafico.paralelo_confirmar())
	montar_versao()
	P = Progresso.new()
	h.vida = P.st.vidaMax
	h.mana = P.st.manaMax
	armas_lugar = JSON.parse_string(FileAccess.get_file_as_string("res://modelos/armas.json"))
	mundo = JSON.parse_string(FileAccess.get_file_as_string("res://dados/mundo.json"))
	pre_carregar()
	terreno = Terreno.new(mundo)
	mov = Andar.new(terreno, mundo)
	mov.jogo = self
	mascara = load("res://modelos/mascara_vila.png").get_image()
	if mascara.is_compressed():
		mascara.decompress()
	montar_ambiente()
	var vila: Node3D = load("res://modelos/vila.glb").instantiate()
	add_child(vila)
	vila_no = vila
	for mi in vila.find_children("*", "MeshInstance3D", true, false):
		if mi.get_aabb().size.x > 200.0: # o chão do site: troco pelo meu, com as trilhas
			mi.visible = false
	pintar(vila, false)
	montar_mata(vila)
	cenario = Cenario.new(self)
	add_child(cenario)
	vilas_mundo = VilasMundo.new(self)
	add_child(vilas_mundo)
	alcance_da_vila(vila)
	achar_troncos(vila)
	juntar_vila(vila)
	montar_chao()
	# André 2026-11-10 ("pode tirar essas plantinhas quadradas que sobraram, todas, no mapa inteiro; deixa só o mato
	# novo"): as folhinhas de grama antigas (montar_grama, grama.gdshader) não são mais montadas; o capim e a samambaia
	# do mato.gd ficam. O nó vazio fica para quem ainda fala com a grama (Teste "Sem grama", construcao.gd).
	grama = MultiMeshInstance3D.new()
	# fonte do jogo (Alegreya Sans, OFL) no lugar da letra padrão do Godot: HUD, menus e números de dano
	ThemeDB.fallback_font = load("res://fontes/AlegreyaSans-Bold.ttf")
	fx = Efeitos.new()
	fx.mundo = self
	add_child(fx)
	boss_mundo = BossMundo.new(self)
	add_child(boss_mundo)
	agua_fx = AguaFx.new()
	add_child(agua_fx)
	combate = Combate.new(self)
	criar_heroi()
	for b in BANDO:
		var e := criar_inimigo(b.id, Vector3(b.x, 0, b.z), b.get("nome", "Inimigo"), b.get("escala", 1.0))
		e.tipo = b.tipo
		e.vida_max = VIDA_INIMIGO.get(b.tipo, D.INIMIGO.vida)
		e.vida = e.vida_max
	# 111 monstros e os espantalhos nascem aos poucos depois que a tela abre (criar_aos_poucos), na mesma ordem de
	# antes: o servidor chama cada um pela posição na lista (v). Todos ficam a mais de 70 m de onde o herói nasce.
	montar_cacas() # só põe na fila
	_a_criar.append(montar_treino)
	for n in mundo.get("npcs", []):
		if n.get("vila") != null: # gente das mini vilas do mundo grande: o corpo só nasce de perto (npcs_das_vilas)
			npcs_vila.append(n)
			continue
		criar_npc(MODELO_NPC.get(n.id, "vivi"), Vector3(float(n.x), 0, float(n.z)), str(n.nome).get_slice(",", 0), n)
	camera = Camera3D.new()
	camera.far = 400
	add_child(camera)
	cam = CameraHeroi.new(self, camera)
	cam.colocar(heroi.position)
	sons = Sons.new()
	add_child(sons)
	sons.ouvinte = heroi
	musica = Musica.new()
	add_child(musica)
	hud = Hud.new()
	add_child(hud)
	hud.apertou.connect(usar)
	morte = Morte.new(self)
	add_child(morte)
	hud.soltou.connect(func(a): if a == "basico": h.segurando = false)
	hud.nome = "Ruiva"
	mostrar_build()
	trabalho = Trabalho.new(self)
	add_child(trabalho)
	pesca = Pesca.new(self)
	add_child(pesca)
	transporte = Transporte.new(self)
	add_child(transporte)
	menu = Menu.new(self)
	add_child(menu)
	conversa = Conversa.new(self)
	add_child(conversa)
	rota = Rota.new(self)
	add_child(rota)
	hud.tocou.connect(conversa.tocou_tela)
	troca = Troca.new(self)
	add_child(troca)
	leilao = LeilaoUi.new(self)
	add_child(leilao)
	reforco = Reforco.new(self)
	add_child(reforco)
	festa = Festa.new(self)
	add_child(festa)
	hud.festa = festa
	hud.tocou.connect(troca.tocou_tela) # tocar noutro jogador perto: pedir troca
	hud.troca = troca
	amigos = Amigos.new(self)
	add_child(amigos)
	hud.tocou.connect(tocou_inimigo) # tocar num monstro: vira o alvo travado do mago
	criador = Criador.new(self)
	add_child(criador)
	var cfg := ConfigFile.new()
	var tem_cfg := cfg.load(ARQUIVO_APARENCIA) == OK
	if tem_cfg: # corpo escolhido da última vez (sem internet vale o do celular; online vale o da conta)
		trocar_corpo(str(cfg.get_value("heroi", "visual", "ruiva")), false)
	definir_aparencia(JSON.parse_string(str(cfg.get_value("heroi", "aparencia", "{}"))) if tem_cfg else {}, false)
	montar_teste()
	online = Online.new(self)
	add_child(online)
	chat = Chat.new(self) # antes do menu do topo: o ícone do balão liga o número de não lidas
	add_child(chat)
	menu_topo = MenuTopo.new(self)
	add_child(menu_topo)
	hud.menu_topo = menu_topo
	musica.tocar() # depois do menu do topo, que já aplicou o volume salvo da música
	minimapa = Minimapa.new(self)
	add_child(minimapa)
	hud.minimapa = minimapa
	volta = VoltaVila.new(self)
	add_child(volta)
	totem = Totem.new(self)
	add_child(totem)
	nevoa = Nevoa.new(self)
	add_child(nevoa)
	if mov:
		mov.nevoa = nevoa
	missao_ativa = MissaoAtiva.new(self)
	add_child(missao_ativa)
	hud.missao = missao_ativa
	cinematica = Cinematica.new(self)
	add_child(cinematica)
	volta.carregar() # entra de volta onde estava (online, a primeira foto do servidor manda o lugar da conta)
	construcao = Construcao.new(self)
	add_child(construcao)
	hud.construcao = construcao
	hud.tocou.connect(construcao.tocou_tela) # modo construção: tocar no chão leva a mira para lá
	editar_hud = EditarHud.new(self) # por último: lê o layout guardado e passa para todos os elementos
	add_child(editar_hud)
	hud.editor = editar_hud
	retrato_heroi = RetratoHeroi.new(self)
	add_child(retrato_heroi)
	grafico.aplicar() # resolução, sombra, névoa e alcance do nível escolhido (Alta = como sempre foi)

# ---------- cenário ----------
func montar_ambiente() -> void:
	var ceu := PanoramaSkyMaterial.new()
	ceu.panorama = load("res://modelos/ceu.hdr")
	var sky := Sky.new()
	sky.sky_material = ceu
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("cfe2ff")
	env.ambient_light_energy = 0.4
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.68
	env.fog_enabled = true
	env.fog_light_color = Color("a9c8e6")
	env.fog_density = 0.0075
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.22 # cores mais vivas, como o passe de cor do site
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sol = DirectionalLight3D.new()
	sol.light_color = Color("fff1d6")
	sol.light_energy = 0.9
	sol.shadow_enabled = true
	sol.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sol.directional_shadow_max_distance = 20.0 # era 30 m; André 2026-11-07 aprovou 20 m (FPS na vila: a sombra era ~45% das chamadas de desenho)
	sol.rotation = Vector3(deg_to_rad(-52), deg_to_rad(60), 0)
	add_child(sol)

func montar_chao() -> void:
	var m := ShaderMaterial.new()
	m.shader = load("res://chao.gdshader")
	m.set_shader_parameter("grama_tex", load("res://modelos/forrest_ground_01.jpg"))
	m.set_shader_parameter("terra_tex", load("res://modelos/stony_dirt_path.jpg"))
	m.set_shader_parameter("pedra_tex", load("res://modelos/cobblestone_floor_01.jpg"))
	m.set_shader_parameter("mascara", load("res://modelos/mascara_vila.png"))
	var mk: Dictionary = mundo.get("mascara", {"x0": -30.0, "z0": -34.0, "tam": 56.0})
	m.set_shader_parameter("area", Vector3(float(mk.x0), float(mk.z0), float(mk.tam)))
	m.set_shader_parameter("grama_cru", load("res://modelos/forrest_ground_01.jpg"))
	m.set_shader_parameter("pedra_cru", load("res://modelos/cobblestone_floor_01.jpg"))
	var p := PlaneMesh.new()
	p.size = Vector2(3000, 3000) # a vila, o campo de fora, a mata e, do alto da montanha, a mata até o horizonte (2026-11-05)
	var chao := MeshInstance3D.new()
	chao.mesh = p
	chao.position = Vector3(95, 0, 70)
	# FASE 3 (mundo grande): o chão plano fica só em volta do mapa de hoje (caixa das áreas + 40 m); o resto é o chão dos
	# continentes e o mar (mundo_terreno.gd)
	if not terreno.mundo_g.is_empty():
		var cx0 := INF
		var cx1 := -INF
		var cz0 := INF
		var cz1 := -INF
		for a in mundo.get("areas", []):
			var r: float = maxf(float(a.get("r", 0.0)), maxf(float(a.get("rx", 0.0)), float(a.get("rz", 0.0)))) * 1.2 + 40.0
			cx0 = minf(cx0, float(a.x) - r)
			cx1 = maxf(cx1, float(a.x) + r)
			cz0 = minf(cz0, float(a.z) - r)
			cz1 = maxf(cz1, float(a.z) + r)
		p.size = Vector2(cx1 - cx0, cz1 - cz0)
		chao.position = Vector3((cx0 + cx1) * 0.5, 0, (cz0 + cz1) * 0.5)
		terreno.ligar_mascara(m) # o chão plano só onde a grade do mundo é o mapa de hoje (nada de quadrado)
		add_child(MundoTerreno.new(terreno))
	chao.material_override = m
	chao.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(chao)
	# lagos e montanha (relevo.gd, pedido do André 2026-11-05): o chão plano abre buraco nos lagos
	# Caverna da Montanha (2026-11-06): nasce antes da montanha, que abre o buraco da boca para o arco da caverna
	caverna = Caverna.new(self, terreno)
	relevo = Relevo.new(terreno, m, load("res://modelos/forrest_ground_01.jpg"), caverna.buraco_na_montanha)
	add_child(relevo)
	add_child(caverna)
	# Parte 8 (2026-11-09): as cavernas do mundo grande, o mesmo desenho (montam só com o herói perto)
	for cm in terreno.tuneis_mundo:
		var cw = Caverna.new(self, terreno, cm)
		cavernas_mundo.append(cw)
		add_child(cw)
	dia = preload("res://dia_noite.gd").new(self) # dia e noite (André 2026-11-07): depois do ambiente e da caverna
	add_child(dia)
	add_child(Submerso.new(self)) # câmera dentro do lago: tom azul, neblina e luz da superfície (André 2026-11-07)
	relevo.copas_simples(arvores_mata, _malhas_mata) # do alto: as árvores além de 80 m viram copas simples
	mato = Mato.new(self) # capim alto e samambaia de verdade em volta do herói (André 2026-11-10)
	add_child(mato)
	leve = preload("res://visual_leve.gd").new(self) # depois da mata, do chão e do mato (acha tudo que já existe)
	add_child(leve)

# chão onde um efeito ou um drop cai: com o herói lá dentro da caverna da montanha, o chão da caverna (não o alto da
# montanha, que fica por cima do túnel)
func chao_em(x: float, z: float) -> float:
	if heroi != null and terreno != null and not terreno.dentro_caverna(heroi.position.x, heroi.position.z, heroi.position.y + 0.3).is_empty():
		return terreno.altura(x, z, heroi.position.y + 0.5)
	return terreno.altura(x, z) if terreno else 0.0

func peso_vila(x: float, z: float) -> float:
	var mk: Dictionary = mundo.get("mascara", {"x0": -30.0, "z0": -34.0, "tam": 56.0})
	var i := int((x - float(mk.x0)) / float(mk.tam) * mascara.get_width())
	var j := int((z - float(mk.z0)) / float(mk.tam) * mascara.get_height())
	if i < 0 or j < 0 or i >= mascara.get_width() or j >= mascara.get_height():
		return 0.0
	var c := mascara.get_pixel(i, j)
	return max(c.r, c.g)

# Estilo pintado do site: sombra em degraus (toon), sem brilho de foto, contorno escuro nos personagens
var pintados := {}
var folhas: Array = [] # [MeshInstance3D, AABB no mundo] de copas e samambaias (somem quando tapam o herói)
func pintar(raiz: Node, personagem: bool, ruivo := false) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if not personagem and mi.mesh.get_surface_count() > 0:
			var m0 = mi.mesh.surface_get_material(0)
			if m0 is BaseMaterial3D and m0.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
				folhas.append([mi, null])
		for i in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(i)
			if not (m is StandardMaterial3D):
				continue
			var nome_mat: String = m.resource_name + " " + mi.mesh.surface_get_name(i)
			var chave = [m, ruivo]
			if not pintados.has(chave):
				var n: StandardMaterial3D = m.duplicate()
				n.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
				n.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
				n.metallic = 0.0
				n.roughness = 1.0
				n.normal_enabled = false
				if personagem:
					n.emission_enabled = false # o brilho próprio do VRoid deixava pele e cabelo lavados
				if n.albedo_texture and not personagem:
					n.albedo_color = n.albedo_color.lerp(Color.WHITE, 0.3)
				if not personagem and n.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
					# folhagem (copas, samambaias): some em degradê perto da câmera, em vez de virar uma folha gigante na tela
					n.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_DITHER
					# samambaia e arbusto (baixos, ficam entre a câmera e o herói): somem mais cedo que as copas
					var baixo: bool = mi.mesh.get_aabb().size.y < 2.0
					n.distance_fade_min_distance = 1.4 if baixo else 0.6
					n.distance_fade_max_distance = 3.0 if baixo else 1.5
				if personagem and "(Outline)" in nome_mat:
					# contorno escuro de desenho (como o MToon): casca um pouco maior, só o lado de trás
					n.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
					n.cull_mode = BaseMaterial3D.CULL_FRONT
					n.grow = true
					n.grow_amount = 0.006
					n.albedo_color = Color(0.12, 0.08, 0.08)
					n.albedo_texture = null
				elif personagem:
					if "SKIN" in nome_mat:
						n.albedo_color = Color(1.0, 0.9, 0.84) # pele com um pouco de cor (o MToon do site sombreia em rosado)
						pele_viva(n, "Face" in nome_mat)
					n.rim_enabled = true # contorno de luz de desenho
					n.rim = 0.25
					n.rim_tint = 0.6
				if ruivo and "HAIR" in nome_mat:
					n.albedo_color = Color(0.9, 0.5, 0.36)
				pintados[chave] = n
			mi.mesh.surface_set_material(i, pintados[chave])

# pele com volume (André 2026-11-05: "um branco liso sem sombra sem brilho"), só com o que o material do Godot já faz,
# sem shader novo nem passe a mais (custa o mesmo no celular):
# - sombra quente: a luz de trás (backlight) entra só no lado escuro, rosada, como o sangue por baixo da pele (sem ela
#   a sombra fica cinza e o claro fica um branco só)
# - contorno de luz um pouco mais forte (o brilho da pele na borda)
# A rugosidade fica 1.0: no toon ela é a largura da passagem luz/sombra, e abaixo disso o rosto do VRoid escurece
# inteiro (cinza). O rosto leva menos rosado que o corpo (o desenho do VRoid já traz blush).
# A pele com cor do criador (aparencia.gd, _shader com pele) faz a mesma ideia na luz própria dela.
static func pele_viva(n: BaseMaterial3D, rosto: bool) -> void:
	n.backlight_enabled = true
	n.backlight = Color(0.24, 0.1, 0.06) if rosto else Color(0.32, 0.12, 0.07)
	n.rim = 0.32

func hsl(hh: float, s: float, l: float) -> Color:
	var v: float = l + s * min(l, 1.0 - l)
	return Color.from_hsv(hh, 0.0 if v == 0.0 else 2.0 * (1.0 - l / v), v)

func montar_grama() -> void:
	var m := PlaneMesh.new()
	m.size = Vector2(0.06, 0.3)
	m.orientation = PlaneMesh.FACE_Z
	m.subdivide_depth = 2
	m.center_offset = Vector3(0, 0.15, 0)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://grama.gdshader")
	m.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = m
	# a vila com a mesma quantidade do celular no site; as áreas de fora (mundo.areas depois da primeira) na mesma densidade
	var n0 := 22000
	var fora: Array = mundo.get("areas", []).slice(1).filter(func(o): return not o.get("mata", false)) # a mata tem a dela (grama_da_mata)
	var extras: Array = []
	for o in fora:
		var area: float = float(o.rx) * float(o.rz) if o.has("rx") else float(o.r) * float(o.r)
		extras.append(int(n0 * area / pow(RAIO * 1.15, 2) * 0.8))
	mm.instance_count = n0 + extras.reduce(func(s, n): return s + n, 0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261103 # sempre o mesmo sorteio: dá para guardar pronto no celular (grama_guardada)
	var buf := grama_guardada("vila", mm.instance_count)
	if buf.size() != mm.instance_count * 16:
		buf.resize(mm.instance_count * 16)
		for i in mm.instance_count:
			var cx := 0.0
			var cz := 0.0
			var rr := RAIO * 1.15
			var ini := n0
			for q in fora.size():
				if i >= ini:
					cx = float(fora[q].x)
					cz = float(fora[q].z)
					rr = (max(float(fora[q].rx), float(fora[q].rz)) * 1.27) if fora[q].has("rx") else float(fora[q].r) * 1.1
				ini += extras[q]
			var a := 0.0
			var r := 0.0
			for k in 20: # não nasce nas trilhas, na praça nem colada nas casas
				a = rng.randf() * TAU
				r = sqrt(rng.randf()) * rr
				if peso_vila(cx + cos(a) * r, cz + sin(a) * r) <= 0.2 and (i < n0 or mov.dentro_do_mapa(cx + cos(a) * r, cz + sin(a) * r, -3.0)) and not fora_do_plano(cx + cos(a) * r, cz + sin(a) * r):
					break
			var s := rng.randf_range(0.7, 1.3)
			var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.6, 1.4), s))
			folha(buf, i, b, Vector3(cx + cos(a) * r, 0, cz + sin(a) * r), hsl(rng.randf_range(0.22, 0.27), rng.randf_range(0.45, 0.62), rng.randf_range(0.3, 0.46))) # PALETA.grama do site
		guardar_grama("vila", buf)
	mm.buffer = buf
	grama = MultiMeshInstance3D.new()
	grama.multimesh = mm
	grama.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(grama)
	picar_grama(mm, buf, grama) # o desenho vai em pedaços, filhos deste (o "Sem grama" do Teste ainda esconde tudo)
	grama_da_mata(m, rng)

# Mata (2026-11-03): chão de floresta com pouca grama, mais cheia nas clareiras. Um pedaço por círculo da mata, que
# só é desenhado até 70 m (são muitos)
# lago (com a beirada) ou encosta da montanha: grama solta não nasce (shared/dados.js noRelevo)
# 2026-11-06: a beirada é a faixa de terra em volta da água (mundo.beira) mais um tiquinho
var _folga_beira := 0.8
# em cima da pedra de um totem de teleporte (André 2026-11-10)? Grama e mato não nascem ali
var _totens_chao: Array = []
func no_totem(x: float, z: float) -> bool:
	if _totens_chao.is_empty():
		var td = P.dados.get("totens", {})
		var rr: float = float(td.get("raio", 1.75)) + 0.4 if td is Dictionary else 2.0
		for t in (td.get("lista", []) if td is Dictionary else []):
			_totens_chao.append(Vector3(float(t.x), rr, float(t.z)))
		if _totens_chao.is_empty():
			_totens_chao.append(Vector3(1e9, 0, 1e9))
	for t in _totens_chao:
		if absf(x - t.x) < t.y and absf(z - t.z) < t.y and Vector2(x - t.x, z - t.z).length() < t.y:
			return true
	return false

func fora_do_plano(x: float, z: float) -> bool:
	if no_totem(x, z):
		return true
	if mundo.has("beira"):
		_folga_beira = float(mundo.beira.get("terra_max", 1.6)) * 0.5 + 0.3
	if terreno.altura_montanha(x, z) > 0.15:
		return true
	for L in terreno.lagos:
		if absf(x - L.x) < L.R + 2.0 and absf(z - L.z) < L.R + 2.0 and Terreno.margem_lago(L, x, z) < 1.0 + _folga_beira / minf(L.rx, L.rz):
			return true
	return false

func grama_da_mata(m: Mesh, rng: RandomNumberGenerator) -> void:
	var areas: Array = mundo.get("areas", [])
	for q in areas.size():
		var o: Dictionary = areas[q]
		if not o.get("mata", false):
			continue
		var r0: float = float(o.rx)
		rng.seed = 7000 + q # sempre o mesmo sorteio por círculo (dá para guardar pronto)
		var guardada := grama_guardada("mata%d" % q, -1)
		if guardada.size() >= 16:
			var mg := MultiMesh.new()
			mg.transform_format = MultiMesh.TRANSFORM_3D
			mg.use_colors = true
			mg.mesh = m
			mg.instance_count = guardada.size() / 16
			mg.buffer = guardada
			var gg := MultiMeshInstance3D.new()
			gg.multimesh = mg
			gg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			gg.visibility_range_end = 70.0
			add_child(gg)
			grama_mata.append(gg)
			continue
		var pts: Array = []
		for t in int(r0 * r0 * 3.2):
			var a := rng.randf() * TAU
			var r := sqrt(rng.randf()) * r0 * 1.1
			var x := float(o.x) + cos(a) * r
			var z := float(o.z) + sin(a) * r
			if not mov.dentro_do_mapa(x, z, -2.0) or peso_vila(x, z) > 0.2 or fora_do_plano(x, z):
				continue
			var antes := false # o pedaço de outro círculo já cobre aqui
			for k in q:
				var o2: Dictionary = areas[k]
				if o2.get("mata", false) and Vector2(x - float(o2.x), z - float(o2.z)).length() < float(o2.rx) * 1.1:
					antes = true
					break
			if antes:
				continue
			var na_clareira := false
			for c in mundo.get("caca", []):
				if Vector2(x - float(c.x), z - float(c.z)).length() < float(c.r) + 1.0:
					na_clareira = true
					break
			if na_clareira or rng.randf() < 0.3:
				pts.append(Vector2(x, z))
		if pts.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = m
		mm.instance_count = pts.size()
		var buf := PackedFloat32Array()
		buf.resize(pts.size() * 16)
		for i in pts.size():
			var sc := rng.randf_range(0.7, 1.3)
			var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.6, 1.4), sc))
			folha(buf, i, b, Vector3(pts[i].x, 0, pts[i].y), hsl(rng.randf_range(0.22, 0.27), rng.randf_range(0.45, 0.62), rng.randf_range(0.3, 0.46)))
		mm.buffer = buf
		var g := MultiMeshInstance3D.new()
		g.multimesh = mm
		g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.visibility_range_end = 70.0
		add_child(g)
		grama_mata.append(g)
		guardar_grama("mata%d" % q, buf)

# uma folha de grama no formato do MultiMesh (TRANSFORM_3D + cor): 12 números da posição/giro e 4 da cor
func folha(buf: PackedFloat32Array, i: int, b: Basis, o: Vector3, c: Color) -> void:
	var k := i * 16
	buf[k] = b.x.x; buf[k + 1] = b.y.x; buf[k + 2] = b.z.x; buf[k + 3] = o.x
	buf[k + 4] = b.x.y; buf[k + 5] = b.y.y; buf[k + 6] = b.z.y; buf[k + 7] = o.y
	buf[k + 8] = b.x.z; buf[k + 9] = b.y.z; buf[k + 10] = b.z.z; buf[k + 11] = o.z
	buf[k + 12] = c.r; buf[k + 13] = c.g; buf[k + 14] = c.b; buf[k + 15] = c.a

# Grama pronta guardada no celular (2026-11-03): sortear ~40 mil folhas, conferindo trilha, casa e borda do mapa, levava
# uns 3 s na abertura. O sorteio agora é sempre o mesmo, então na primeira vez ele fica gravado em user://grama/ e nas
# próximas só lê. Muda o mapa (mundo.json ou a máscara da vila) ou a versão abaixo: sorteia e grava de novo.
const GRAMA_VERSAO := "1"
var _grama_chave := ""
func _chave_grama() -> String:
	if _grama_chave == "":
		var hc := HashingContext.new()
		hc.start(HashingContext.HASH_MD5)
		hc.update((GRAMA_VERSAO + JSON.stringify(mundo)).to_utf8_buffer())
		if mascara:
			hc.update(mascara.get_data())
		_grama_chave = hc.finish().hex_encode().left(16)
	return _grama_chave

func grama_guardada(nome: String, n: int) -> PackedFloat32Array:
	var f := FileAccess.open("user://grama/%s_%s.bin" % [nome, _chave_grama()], FileAccess.READ)
	if f == null:
		return PackedFloat32Array()
	var b := f.get_buffer(f.get_length()).to_float32_array()
	if n >= 0 and b.size() != n * 16:
		return PackedFloat32Array()
	return b

func guardar_grama(nome: String, buf: PackedFloat32Array) -> void:
	DirAccess.make_dir_recursive_absolute("user://grama")
	var f := FileAccess.open("user://grama/%s_%s.bin" % [nome, _chave_grama()], FileAccess.WRITE)
	if f:
		f.store_buffer(buf.to_byte_array())

# A grama da vila e das áreas de fora era uma peça só: a placa de vídeo desenhava as ~30 mil folhas sempre que qualquer
# pedacinho aparecia na tela. Agora vai em pedaços de 24 m, e cada pedaço só é desenhado perto (como a grama da mata)
# e quando está na frente da câmera.
const GRAMA_PEDACO := 24.0
const GRAMA_ALCANCE := 92.0 # o pedaço some a 92 m do centro; cada folha some antes, encolhendo de 65 a 75 m (grama.gdshader)
var grama_pedacos: Array = []
var grama_mata: Array = [] # grama das clareiras da mata (a construção também tira a que fica embaixo das peças)
func picar_grama(mm: MultiMesh, buf: PackedFloat32Array, inteira: MultiMeshInstance3D) -> void:
	var grupos := {}
	for i in mm.instance_count:
		var k := Vector2i(floori(buf[i * 16 + 3] / GRAMA_PEDACO), floori(buf[i * 16 + 11] / GRAMA_PEDACO))
		if not grupos.has(k):
			grupos[k] = PackedInt32Array()
		grupos[k].append(i)
	for k in grupos:
		var idx: PackedInt32Array = grupos[k]
		var parte := PackedFloat32Array()
		parte.resize(idx.size() * 16)
		for j in idx.size():
			for c in 16:
				parte[j * 16 + c] = buf[idx[j] * 16 + c]
		var p := MultiMesh.new()
		p.transform_format = MultiMesh.TRANSFORM_3D
		p.use_colors = true
		p.mesh = mm.mesh
		p.instance_count = idx.size()
		p.buffer = parte
		var g := MultiMeshInstance3D.new()
		g.multimesh = p
		g.cast_shadow = inteira.cast_shadow
		g.visibility_range_end = GRAMA_ALCANCE
		inteira.add_child(g)
		grama_pedacos.append(g)
	mm.visible_instance_count = 0 # a peça inteira não desenha mais nada (os pedaços desenham)

# Desempenho (2026-11-03): na mata, a vila inteira (619 peças, a 100-200 m, atrás das árvores e da neblina) ainda era
# desenhada: ~600 das ~900 chamadas de desenho do quadro. Agora cada peça da vila só é desenhada até uma distância
# que depende do tamanho (caixote/balde 60 m, cerca/carroça 90 m, casa e árvore 120 m, maiores sempre), com fade curtinho.
# Dentro da vila nada muda (tudo fica bem mais perto que isso).
func alcance_da_vila(vila: Node3D) -> void:
	for mi in vila.find_children("*", "MeshInstance3D", true, false):
		if not mi.visible or mi.mesh == null:
			continue
		var bb: AABB = mi.global_transform * mi.get_aabb()
		var tam: float = max(bb.size.x, max(bb.size.y, bb.size.z))
		if tam >= 20.0:
			continue # chão, morros e o que marca o horizonte ficam sempre
		# André 2026-11-07 ("prefiro perder um pouquinho de qualidade do que ter jogo travando"): 60/90/120 m viraram
		# 45/70/100 m; a neblina já apaga bastante nessa distância e o fade curtinho evita o susto de aparecer de repente
		mi.visibility_range_end = 45.0 if tam < 2.0 else (70.0 if tam < 6.0 else 100.0)
		mi.visibility_range_end_margin = 8.0
		mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF

# Vila em blocos (André 2026-11-07, FPS na vila: "vai só o lance excluindo pedra e árvore"): as 619 peças soltas do
# vila.glb viram poucos blocos, um por pedaço de chão, por distância de sumir (alcance_da_vila), por material e por
# sombra. Cada bloco é uma chamada de desenho só (antes era uma por peça). Ficam soltas, como eram:
# - árvores da vila e do campo (queda_arvore.gd derruba e esconde cada uma; achar_troncos apaga o tronco na câmera)
# - copas transparentes (somem quando tapam o herói: lista folhas); as samambaias entram nos blocos (veja abaixo)
# - pedras (encostar.gd lê a forma de cada pedra de escalar) e tudo perto de um sólido que não é casa
# - o chão e o que é grande (sempre desenhado) e material com shader próprio
const VILA_BLOCO := {45.0: 12.0, 70.0: 20.0, 100.0: 28.0} # distância de sumir -> lado do pedaço de chão (m)
func juntar_vila(vila: Node3D) -> void:
	# samambaias (400 e poucas, todas com o mesmo material): entram nos blocos. Saem do apagar da câmera e somem em
	# degradê já a 4 m dela, como as samambaias do cenario.gd (o bloco inteiro não pode ficar transparente)
	# (cada samambaia veio do glb com uma cópia do mesmo material: a textura diz quem é igual, e o bloco usa um só)
	var uso := {} # textura -> quantas
	var mat_unico := {} # textura -> material que o bloco usa
	for f in folhas:
		var m0 = (f[0] as MeshInstance3D).mesh.surface_get_material(0)
		if f.size() <= 3 and m0 is BaseMaterial3D and m0.albedo_texture != null:
			uso[m0.albedo_texture] = uso.get(m0.albedo_texture, 0) + 1
	var manter := {}
	var rasteira := {} # MeshInstance3D -> material do bloco
	for f in folhas:
		var mi: MeshInstance3D = f[0]
		var m0 = mi.mesh.surface_get_material(0)
		if f.size() <= 3 and m0 is BaseMaterial3D and uso.get(m0.albedo_texture, 0) >= 20 and mi.material_override == null \
				and mi.mesh.get_surface_count() == 1 and (mi.global_transform * mi.get_aabb()).size.y < 2.0:
			if not mat_unico.has(m0.albedo_texture):
				var mu: BaseMaterial3D = m0.duplicate()
				mu.distance_fade_min_distance = 2.2
				mu.distance_fade_max_distance = 4.2
				mat_unico[m0.albedo_texture] = mu
			rasteira[mi] = mat_unico[m0.albedo_texture]
		else:
			manter[mi] = true
	var arv: Array = []
	for a in mundo.get("coletaveis", []):
		if str(a.tipo) == "arvore":
			arv.append(Vector2(float(a.x), float(a.z)))
	var pedras: Array = []
	for r in terreno.solidos:
		if not r.get("casa", false):
			pedras.append(r)
	var base_inv: Transform3D = vila.global_transform.affine_inverse()
	var grupos := {} # [lado_x, lado_z, alcance, sombra] -> {material id -> [material, SurfaceTool]}
	var feitos: Array = []
	for mi: MeshInstance3D in vila.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.skin != null or not mi.is_visible_in_tree() or manter.has(mi) or mi.get_child_count() > 0:
			continue
		var alc: float = mi.visibility_range_end
		if not VILA_BLOCO.has(alc):
			continue # grande, sempre desenhado
		var bb: AABB = mi.global_transform * mi.get_aabb()
		var c := Vector2(bb.get_center().x, bb.get_center().z)
		var o := Vector2(mi.global_position.x, mi.global_position.z)
		var solta := false
		for a in arv:
			if o.distance_to(a) < 0.2 or (not rasteira.has(mi) and (c.distance_to(a) < 2.5 or o.distance_to(a) < 2.5)):
				solta = true
				break
		if not solta and not rasteira.has(mi):
			for r in pedras:
				if c.distance_to(Vector2(r.x, r.z)) < float(r.R) * 1.6 + 0.8:
					solta = true
					break
		if solta:
			continue
		var tem_shader := false
		for i in mi.mesh.get_surface_count():
			var mt = mi.get_active_material(i)
			if mt != null and not (mt is BaseMaterial3D):
				tem_shader = true
			elif mt is BaseMaterial3D and mt.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED and not rasteira.has(mi):
				tem_shader = true
			if mi.mesh is ArrayMesh and (mi.mesh as ArrayMesh).surface_get_primitive_type(i) != Mesh.PRIMITIVE_TRIANGLES:
				tem_shader = true
		if tem_shader:
			continue
		var lado: float = VILA_BLOCO[alc]
		var k := [floori(c.x / lado), floori(c.y / lado), alc, int(mi.cast_shadow)]
		if not grupos.has(k):
			grupos[k] = {}
		var t: Transform3D = base_inv * mi.global_transform
		for i in mi.mesh.get_surface_count():
			var mat: Material = rasteira.get(mi, mi.get_active_material(i))
			var chave := mat.get_instance_id() if mat else 0
			if not grupos[k].has(chave):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				grupos[k][chave] = [mat, st]
			(grupos[k][chave][1] as SurfaceTool).append_from(mi.mesh, i, t)
		feitos.append(mi)
	var n := 0
	for k in grupos:
		var am := ArrayMesh.new()
		for chave in grupos[k]:
			var g: Array = grupos[k][chave]
			(g[1] as SurfaceTool).commit(am)
			am.surface_set_material(am.get_surface_count() - 1, g[0])
		if am.get_surface_count() == 0:
			continue
		var bloco := MeshInstance3D.new()
		bloco.name = "bloco_%d" % n
		bloco.mesh = am
		bloco.cast_shadow = k[3]
		bloco.visibility_range_end = k[2]
		bloco.visibility_range_end_margin = 8.0
		bloco.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		vila.add_child(bloco)
		n += 1
	for i in range(folhas.size() - 1, -1, -1):
		if rasteira.has(folhas[i][0]) and feitos.has(folhas[i][0]):
			folhas.remove_at(i)
	for mi: MeshInstance3D in feitos:
		mi.get_parent().remove_child(mi)
		mi.free()
	print("vila em blocos: ", feitos.size(), " peças -> ", n, " blocos")

# Árvores da mata (mundo.mata, as mesmas do servidor): o vila.glb traz um modelo de cada (mata_tronco_v e mata_copa_v,
# na origem) e aqui elas viram MultiMesh por pedaços de 32 m, desenhados até 80 m (a neblina esconde o resto).
# Direção de arte (nada de pomar): cada árvore gira, inclina até 5°, fica um pouco mais alta ou mais larga e a copa
# varia de tom (±8% de valor). O sorteio sai da posição, então é sempre o mesmo. Colisão: andar.gd (perto_na_mata).
const MATA_PEDACO := 32.0
const MATA_FADE := 0.15 # s para a árvore inteira sumir (ou voltar) quando tapa a câmera
var arvores_mata := {} # posição -> {t: Transform3D, tronco: [MultiMesh, i], copa: [MultiMesh, i, cor], s}
var _sumindo := {} # posição -> {no: Node3D (cópia com alfa), k: 0..1 (1 = some), quer: 0 ou 1, mats: []}
var _malhas_mata := {} # "tronco_v" / "copa_v" -> Mesh
func montar_mata(vila: Node3D) -> void:
	var modelos := {}
	for mi in vila.find_children("mata_*", "MeshInstance3D", true, false):
		var nome := str(mi.name)
		modelos[nome] = mi.mesh
		for i in range(folhas.size() - 1, -1, -1): # o modelo na origem não entra na conta das copas que tapam o herói
			if folhas[i][0] == mi:
				folhas.remove_at(i)
		mi.queue_free()
	var pedacos := {}
	for a in mundo.get("mata", []):
		var k := Vector3i(floori(float(a.x) / MATA_PEDACO), floori(float(a.z) / MATA_PEDACO), int(a.v))
		if not pedacos.has(k):
			pedacos[k] = []
		pedacos[k].append(a)
	var mats := {}
	var rng := RandomNumberGenerator.new()
	for k in pedacos:
		var lista: Array = pedacos[k]
		var mms := {}
		for parte in ["tronco", "copa"]:
			var mesh: Mesh = modelos.get("mata_%s_%d" % [parte, k.z])
			if mesh == null:
				continue
			_malhas_mata["%s_%d" % [parte, k.z]] = mesh
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = parte == "copa"
			mm.mesh = mesh
			mm.instance_count = lista.size()
			mms[parte] = mm
			var g := MultiMeshInstance3D.new()
			g.multimesh = mm
			g.visibility_range_end = 80.0
			g.visibility_range_end_margin = 6.0
			g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			var base = mesh.surface_get_material(0)
			if base is BaseMaterial3D and parte == "copa": # o verde de cada árvore multiplica a cor da folha
				if not mats.has(base):
					var mt: BaseMaterial3D = base.duplicate()
					mt.vertex_color_use_as_albedo = true
					mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_DISABLED # sem pontilhado: quem some é a árvore inteira
					mats[base] = mt
				g.material_override = mats[base]
			add_child(g)
		for i in lista.size():
			var a: Dictionary = lista[i]
			var pos := Vector2(float(a.x), float(a.z))
			rng.seed = hash(pos)
			var sc := float(a.s)
			var eixo := Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1)).normalized()
			var b := Basis(eixo, deg_to_rad(rng.randf_range(-5.0, 5.0))) * Basis(Vector3.UP, float(a.ry))
			b = b.scaled(Vector3(sc * rng.randf_range(0.9, 1.1), sc * rng.randf_range(0.88, 1.15), sc * rng.randf_range(0.9, 1.1)))
			var t := Transform3D(b, Vector3(pos.x, float(a.get("y", 0.0)), pos.y))
			var info := {"t": t, "s": sc, "v": int(a.v)}
			if mms.has("tronco"):
				mms.tronco.set_instance_transform(i, t)
				info.tronco = [mms.tronco, i]
			if mms.has("copa"):
				var j := i + int(a.x * 7.0)
				var cor := hsl(0.22 + (j % 5) * 0.012, 0.35, 0.62 + (j % 3) * 0.06)
				cor = Color.from_hsv(cor.h, cor.s, clamp(cor.v * rng.randf_range(0.92, 1.08), 0.0, 1.0))
				mms.copa.set_instance_transform(i, t)
				mms.copa.set_instance_color(i, cor)
				info.copa = [mms.copa, i, cor]
			arvores_mata[pos] = info

# ---------- personagens ----------
func modelo(id: String) -> Node3D:
	if not cache.has(id):
		cache[id] = load("res://modelos/%s.glb" % id)
	var no: Node3D = cache[id].instantiate()
	add_child(no)
	var anim: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
	for nome in anim.get_animation_list():
		anim.get_animation(nome).loop_mode = Animation.LOOP_LINEAR if nome in LACOS else Animation.LOOP_NONE
	anim.play("parada")
	pintar(no, true, id == "ruiva")
	sem_sombra_no_rosto(no)
	if id in SEM_CASACO:
		VisualNpc.tirar_casaco(no)
	molas(no)
	return no

# NPC de longe (André 2026-11-07, FPS na vila, escolheu sombra e contorno só de perto): a mais de 15 m o NPC não
# desenha sombra e o contorno de desenho (a casca escura um pouco maior que o corpo) troca por um material que não
# desenha nada; de perto volta tudo igual (a sombra que cada pedaço tinha e o contorno de antes).
const NPC_LONGE := 45.0 # m: NPC da vila mais longe que isso some (era 70, o mesmo dos monstros)
const NPC_DETALHE := 10.0 # André 2026-11-11: era 15 (NPCs mais leves, celular mediano)
const NPC_DETALHE_SAI := 12.0 # volta a ter detalhe só abaixo de 10 m, sai acima de 12 m (não pisca no limite)
const NPC_ANIM_LONGE := 25.0 # m: NPC da vila mais longe que isso anima a cada 3 quadros (perto disso, a cada 2)
static var _mat_nada: ShaderMaterial
# FPS (auditoria 2026-11-11, Teste no celular): cada corpo humano custava quase 1 ms do processador por quadro, mesmo
# longe. Longe do herói, a animação E os ajustes de osso (molas do cabelo e da saia, mão fechada, ombro do ferreiro,
# capa) passam a andar só quando o jogo manda (advance), a cada 2 ou 3 quadros. Antes o esqueleto refazia todos os
# ossos todo quadro só porque tinha um modificador, mesmo com a animação espaçada. Perto (e o herói) fica igual.
static func anim_espacada(anim: AnimationPlayer, esq: Skeleton3D, espacar: bool) -> void:
	if anim:
		anim.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL if espacar else AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_IDLE
	if esq:
		esq.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL if espacar else Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_IDLE

static func npc_simples(no: Node, simples: bool) -> void:
	if _mat_nada == null:
		var sh := Shader.new()
		sh.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled, shadows_disabled;\nvoid vertex() { POSITION = vec4(2.0, 2.0, 2.0, 1.0); }\nvoid fragment() { ALBEDO = vec3(0.0); }\n"
		_mat_nada = ShaderMaterial.new()
		_mat_nada.shader = sh
	for mi: MeshInstance3D in no.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		mi.lod_bias = 0.35 if simples else 0.8 # LOD mais forte nos NPCs (o herói não passa por aqui)
		if simples:
			if not mi.has_meta("sombra_perto"):
				mi.set_meta("sombra_perto", mi.cast_shadow)
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			if mi.material_override != null:
				continue
			for i in mi.mesh.get_surface_count():
				var mt := mi.get_active_material(i)
				if mt is BaseMaterial3D and (mt as BaseMaterial3D).grow and (mt as BaseMaterial3D).cull_mode == BaseMaterial3D.CULL_FRONT:
					mi.set_meta("contorno_%d" % i, [mi.get_surface_override_material(i)]) # [null] = o da malha
					mi.set_surface_override_material(i, _mat_nada)
		else:
			if mi.has_meta("sombra_perto"):
				mi.cast_shadow = mi.get_meta("sombra_perto")
				mi.remove_meta("sombra_perto")
			for i in mi.mesh.get_surface_count():
				if mi.has_meta("contorno_%d" % i):
					mi.set_surface_override_material(i, mi.get_meta("contorno_%d" % i)[0])
					mi.remove_meta("contorno_%d" % i)

# Pecinhas do corpo (olho, cílio, brilho, fivela, rebite: menos de PECINHA_TRIS triângulos) só são desenhadas até
# PECINHA_LONGE m da câmera (alcance de visão do Godot). De longe elas viram 1 ou 2 pontos na tela, mas cada uma é uma
# chamada de desenho a mais: ~40 por NPC (André 2026-11-11: liso em celular mediano). O herói não passa por aqui.
const PECINHA_TRIS := 400
const PECINHA_LONGE := 14.0
static func pecinhas_de_perto(no: Node) -> void:
	for mi: MeshInstance3D in no.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.visibility_range_end > 0.0:
			continue
		var am: ArrayMesh = mi.mesh
		var tris := 0
		for i in am.get_surface_count():
			var n := am.surface_get_array_index_len(i)
			tris += (n if n > 0 else am.surface_get_array_len(i)) / 3
		if tris < PECINHA_TRIS:
			mi.visibility_range_end = PECINHA_LONGE
			mi.visibility_range_end_margin = 1.0

# FPS (André 2026-11-07, vila): cada personagem (herói, NPC, outro jogador) tem 8 pecinhas do rosto (olhos, brilho do
# olho, boca, cílios, delineado, sobrancelha) e cada uma também era desenhada de novo na sombra. Elas ficam coladas no
# rosto, dentro da sombra da cabeça, então a sombra delas não aparece: só gastava 8 chamadas de desenho por personagem.
# A sombra da cabeça, do cabelo e do corpo continua igual.
const ROSTO_SEM_SOMBRA := ["FaceMouth", "EyeIris", "EyeHighlight", "EyeWhite", "EyeExtra", "FaceEyelash", "FaceEyeline", "FaceBrow"]
static func sem_sombra_no_rosto(no: Node) -> void:
	for mi: MeshInstance3D in no.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.mesh.get_surface_count() == 0:
			continue
		var so_rosto := true
		for i in mi.mesh.get_surface_count():
			var mt := mi.mesh.surface_get_material(i)
			var nome: String = mt.resource_name if mt else ""
			var achou := false
			for k in ROSTO_SEM_SOMBRA:
				if k in nome:
					achou = true
					break
			if not achou:
				so_rosto = false
				break
		if so_rosto:
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

# aparência do herói (criador de personagem): pinta o herói e o boneco do menu e guarda no celular
func definir_aparencia(a, salvar := true) -> void:
	aparencia = Aparencia.valida(a, P.dados.criador)
	Aparencia.aplicar(heroi, aparencia)
	if menu and menu.boneco:
		Aparencia.aplicar(menu.boneco, aparencia)
	if salvar:
		var cfg := ConfigFile.new()
		cfg.set_value("heroi", "aparencia", JSON.stringify(aparencia))
		cfg.set_value("heroi", "visual", visual)
		cfg.save(ARQUIVO_APARENCIA)

# botão Aparência do menu do personagem: abre o criador sem o nome; online quem grava é o servidor ("mudarAparencia"
# e "mudarVisual" para o corpo)
func abrir_aparencia() -> void:
	criador.abrir_edicao(aparencia, func(a, corpo):
		var trocou: bool = corpo != visual
		trocar_corpo(corpo, false)
		definir_aparencia(a)
		if on():
			rede("mudarAparencia", a)
			if trocou:
				rede("mudarVisual", corpo)
		hud.aviso("Aparência salva"), visual)

# corpo que existe no jogo (lista do criador e modelo exportado); senão a Ruiva
func corpo_valido(v) -> String:
	var l: Array = P.dados.criador.get("corpos", ["ruiva"])
	var s := str(v)
	if s in l and ResourceLoader.exists("res://modelos/%s.glb" % s):
		return s
	# corpo que saiu do criador (André 2026-11-07: só um homem e uma mulher): o do criador do mesmo sexo
	var antigo = P.dados.criador.get("corposAntigos", {}).get(s, "ruiva")
	return antigo if str(antigo) in l else "ruiva"

# onde a espada e o cajado ficam presos no corpo do herói (cada corpo tem a mão num jeito)
func lugar_armas(id := "") -> Dictionary:
	var k := id if id != "" else visual
	return armas_lugar.get(k, armas_lugar.ruiva)

# troca o corpo do herói (criador de personagem) no mesmo lugar: refaz o modelo, as armas, a roupa e a pintura
func trocar_corpo(v, salvar := true) -> void:
	var novo := corpo_valido(v)
	if novo == visual and heroi != null:
		return
	montar_lobo(false, false) # o lobo segura o esqueleto do corpo antigo (o servidor acerta pela foto)
	visual = novo
	if heroi == null:
		return
	var pos: Vector3 = heroi.position
	var ry: float = heroi.rotation.y
	var modo: String = h.modo
	if pesca:
		pesca.recolher() # a vara sai das mãos antes de trocar o corpo
	if trabalho:
		trabalho.parar(true) # a picareta e o machado saem da mão antes (senão iam junto com o corpo velho)
		for k in trabalho.ferramentas:
			var f: Node3D = trabalho.ferramentas[k]
			if f.get_parent() != self:
				f.get_parent().remove_child(f)
				add_child(f)
			f.visible = false
	acao = {}
	heroi.queue_free()
	heroi = null
	criar_heroi(false)
	heroi.position = pos
	heroi.rotation.y = ry
	armar(modo)
	_roupa = "-"
	vestir_heroi()
	Aparencia.aplicar(heroi, aparencia)
	if sons:
		sons.ouvinte = heroi
	if menu:
		menu.trocar_boneco()
	if online and online.get("corpos") is Dictionary:
		online.corpos[online.meu_id] = heroi
	if salvar:
		definir_aparencia(aparencia)

func esqueleto(no: Node) -> Skeleton3D:
	var l := no.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

# arma presa num osso (BoneAttachment), na mesma posição do jogo HTML
func prender(esq: Skeleton3D, arma: Node3D, lugar: Dictionary) -> BoneAttachment3D:
	var ba := BoneAttachment3D.new()
	ba.bone_name = lugar.osso
	esq.add_child(ba)
	var q := Quaternion(lugar.quat[0], lugar.quat[1], lugar.quat[2], lugar.quat[3])
	arma.transform = Transform3D(Basis(q).scaled(Vector3.ONE * lugar.escala), Vector3(lugar.pos[0], lugar.pos[1], lugar.pos[2]))
	if arma.get_parent():
		arma.get_parent().remove_child(arma)
	ba.add_child(arma)
	if arma.has_meta("cajado"): # Cajado A: 15% menor (pedido do André) e, na mão, preso na palma em pé
		arma.scale *= Armas.ESCALA_CAJADO
		Armas.segurar(esq, arma)
	if lugar.osso == "J_Bip_C_UpperChest": # nas costas: com capa passa por fora do pano
		arma.set_meta("afastada", 0.0)
		Armadura.costas(esq, arma, esq.get_node_or_null("Armadura_capa") != null)
	return ba

# do_heroi: Espada A e Cajado A (armas3d/, armas.gd); os humanos inimigos seguem com a espada antiga
func nova_arma(nome: String, do_heroi := true) -> Node3D:
	if do_heroi and ResourceLoader.exists("res://armas3d/%s.glb" % nome):
		var n: Node3D = load("res://armas3d/%s.glb" % nome).instantiate()
		Armas.preparar(n)
		if nome == "cajado":
			n.set_meta("cajado", true) # na mão vai para a palma (Armas.segurar)
		return n
	var a: Node3D = load("res://modelos/arma_%s.glb" % nome).instantiate()
	for mi in a.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return a

func criar_heroi(nascer := true) -> void:
	heroi = modelo(visual)
	heroi.position = D.NASCIMENTO
	expressao = Expressao.new(heroi, visual)
	heroi_anim = AnimHeroi.new(heroi.find_child("AnimationPlayer", true, false))
	heroi_esq = esqueleto(heroi)
	mao_direita = heroi_esq.find_bone(lugar_armas().espadaMao.osso)
	mao_esquerda = heroi_esq.find_bone(String(lugar_armas().espadaMao.osso).replace("_R_", "_L_").replace("Right", "Left"))
	if nascer:
		mov.por_em(D.NASCIMENTO)
	espada = nova_arma("espada")
	cajado = nova_arma("cajado")
	armar("Espada")
	braco = BracoEspada.new()
	heroi_esq.add_child(braco)
	heroi_esq.move_child(braco, 0) # antes das molas do cabelo e da saia
	var L: Dictionary = lugar_armas().espadaMao
	braco.preparar(heroi_esq, Basis(Quaternion(L.quat[0], L.quat[1], L.quat[2], L.quat[3])))
	mao_fechada = MaoFechada.new() # dedos em volta do cajado (pedido do André, 2026-11-03)
	heroi_esq.add_child(mao_fechada)
	mao_fechada.preparar(heroi_esq, mao_direita)
	inclinar = Inclinar.new()
	heroi_esq.add_child(inclinar)
	heroi_esq.move_child(inclinar, 0) # antes do braço da espada (que lê a pose do ombro)
	inclinar.preparar(heroi_esq)
	# corpo masculino (sem osso de busto): postura firme de guerreiro, peito erguido e ombros para trás (inclinar.porte)
	inclinar.porte = 0.0 if heroi_esq.find_bone("J_Sec_L_Bust1") >= 0 else 1.0
	heroi_anim.usar_solta(inclinar.porte > 0.0)
	encostar = Encostar.new()
	heroi_esq.add_child(encostar)
	heroi_esq.move_child(encostar, 1) # depois do inclinar, antes do braço da espada e das molas do cabelo
	encostar.preparar(heroi_esq)
	if vila_no != null:
		encostar.achar_rochas(vila_no, terreno.solidos)
	# altura do quadril do herói (m): a freada e a meia-volta andam pelo caminho do quadril da animação, medido nela
	var iq := heroi_esq.find_bone("J_Bip_C_Hips")
	if iq >= 0 and heroi_esq.is_inside_tree():
		var hq: float = (heroi.global_transform.affine_inverse() * (heroi_esq.global_transform * heroi_esq.get_bone_global_rest(iq).origin)).y
		if hq > 0.4 and hq < 1.6:
			mov.altura_quadril = hq
	print("altura do quadril: ", mov.altura_quadril)

# Escalando pedra (André 2026-11-07: "estou muito distante das pedras"): a conta da escalada (andar.gd, igual ao
# servidor) deixa o herói longe da pedra redonda; só o desenho chega para a frente até encostar (encostar.gd mede no
# modelo da pedra) e vira de frente para a face dela. Na escada e passando por cima da beirada fica como era.
const CLIPS_ENCOSTAR := ["parede_agarrado", "parede_beirada", "parede_balanca", "esc_subirParede", "esc_descerParede", "esc_esquerda", "esc_direita"]
func passo_encostar(dt: float) -> void:
	if encostar == null:
		return
	var quer: bool = mov.esc != null and mov.esc.get("escada") == null and mov.anim in CLIPS_ENCOSTAR and h.morto <= 0.0
	encostar.peso = move_toward(encostar.peso, 1.0 if quer else 0.0, dt * 5.0)
	if quer:
		encostar.escolher_perto(heroi.position)
		_encosta = clamp(_encosta + float(encostar.falta) * minf(1.0, dt * 10.0), -0.25, 1.3)
		var n: Vector3 = encostar.normal
		var giro := 0.0
		if n != Vector3.ZERO:
			giro = clamp(mov.ad(atan2(-n.x, -n.z), mov.ry), -0.5, 0.5)
		_encosta_giro = lerpf(_encosta_giro, giro, minf(1.0, dt * 6.0))
	else:
		_encosta = move_toward(_encosta, 0.0, dt * 1.6)
		_encosta_giro = move_toward(_encosta_giro, 0.0, dt * 2.0)
		if encostar.peso <= 0.0 and _encosta == 0.0:
			encostar.escolher_perto(Vector3(1e6, 0, 1e6)) # longe de tudo: não mede nada
	if _encosta != 0.0 or _encosta_giro != 0.0:
		heroi.position += Vector3(sin(mov.ry), 0.0, cos(mov.ry)) * _encosta
		heroi.rotation.y = mov.ry + _encosta_giro

# roupas que aparecem no corpo (armadura.gd): refaz só quando o equipamento muda
var _roupa := "-"
func vestir_heroi() -> void:
	var eq: Dictionary = P.equip_visivel() # sem o capacete se o jogador escondeu (menu, tela de equipamento)
	var k := ""
	for l in Armadura.LUGARES:
		var it = eq.get(l)
		k += (str(it.k) + str(int(it.r)) if it is Dictionary else "") + ","
	if k == _roupa:
		return
	_roupa = k
	Armadura.vestir(heroi, eq)

# sentado no carrinho ou no barquinho (transporte.gd + sentar.gd): as mãos vão no volante ou no remo
func sentado_veiculo() -> bool:
	return mov != null and mov.veiculo.get("k", "") in ["carrinho", "barquinho"]

func armar(modo: String) -> void:
	# modo espada: espada na mão e cajado nas costas; modo magia: o contrário
	# "Coleta" (minerando ou cortando lenha): as duas nas costas, cruzadas em X (pedido do André, 2026-11-06)
	if modo != "Escalada" and modo != "Coleta":
		h.modo = modo
	var L: Dictionary = lugar_armas()
	if modo == "Escalada" or modo == "Coleta" or montaria != null or _nadando or sentado_veiculo(): # escalando, coletando, montado, nadando ou sentado no carrinho/barco: as duas nas costas, mãos livres
		prender(heroi_esq, espada, L.espadaCostas)
		prender(heroi_esq, cajado, L.cajadoCostas)
		if montaria != null:
			armas_montado(heroi_esq, espada, cajado)
		elif modo == "Coleta":
			armas_cruzadas(heroi_esq, espada, cajado)
		_caj_base = cajado.position if _nadando and montaria == null else null
	elif modo == "Espada":
		colisor_espada(heroi_esq, null)
		prender(heroi_esq, espada, L.espadaMao)
		prender(heroi_esq, cajado, L.cajadoCostas)
	else:
		colisor_espada(heroi_esq, null)
		prender(heroi_esq, espada, L.espadaCostas)
		if cajado.get_parent():
			cajado.get_parent().remove_child(cajado)
		heroi.add_child(cajado) # na mão: segue a mão mas fica de pé (como no site), ver _process

# Montado: as armas continuam nas costas e giram para acompanhar o tronco deitado (direção de arte 2026-11-03):
# o cajado vai rente à coluna (chama na altura da nuca, ponteira saindo pelo quadril) e a espada cruza com ele
# num X raso, colada nas costas e abaixo do rabo de cavalo.
const MONTADO_ATRAS := deg_to_rad(25.0) # cajado: giro no eixo do lado do corpo
const MONTADO_CAJADO := [0.0, -0.6] # [giro no plano das costas (rad), desliza pelo cabo (m; - = para o quadril)]
# espada (presa pelo cabo, lâmina para baixo e para trás): com o peito deitado a lâmina já aponta para o rabo do lobo;
# [giro no plano das costas, giro no eixo do lado do corpo (rad)] a deixa rente às costas, e ela desliza
# MONTADO_ESPADA_RECUA m para trás pela lâmina, para o cabo sair do lado da cabeça
const MONTADO_ESPADA := [0.35, 0.45]
const MONTADO_ESPADA_RECUA := 0.22
# Montado em X (pedido do André 2026-11-05: "nas costas cruzando", sem flutuar; montado não ataca): as duas armas
# deitadas no plano das costas, cruzando no meio delas. Cajado com a chama sobre o ombro direito e a ponteira saindo
# pelo quadril esquerdo; espada com o cabo sobre o ombro esquerdo e a ponta no quadril direito, por cima do cajado.
const X_ANGULO := deg_to_rad(35.0) # espada, longe da coluna
const X_ANGULO_CAJADO := deg_to_rad(20.0) # o cajado é mais comprido: mais rente à coluna para a ponteira não sair de lado
const X_FUNDO := 0.115 # m do osso do peito até as costas (cajado); a espada vai X_ESPADA_FORA mais para fora
const X_ESPADA_FORA := 0.03
const X_CENTRO := -0.12 # m pela coluna (- = para o quadril): onde as duas cruzam
const X_CABO := 0.32 # m do cruzamento até o cabo da espada
const X_CAJADO_FIO := 0.55 # o cajado cruza nesse ponto do comprimento dele (0 = ponteira, 1 = chama)
func armas_montado(esq: Skeleton3D, esp: Node3D, caj: Node3D) -> void:
	var b := esq.find_bone("J_Bip_C_UpperChest")
	if b < 0:
		return
	var p := func(n: String) -> Vector3: return esq.get_bone_global_rest(esq.find_bone(n)).origin
	var cima: Vector3 = (p.call("J_Bip_C_Head") - p.call("J_Bip_C_Hips")).normalized()
	var dir: Vector3 = (p.call("J_Bip_R_UpperArm") - p.call("J_Bip_L_UpperArm")).normalized()
	var fr: Vector3 = cima.cross(dir).normalized()
	if (p.call("J_Bip_R_ToeBase") - p.call("J_Bip_R_Foot")).dot(fr) < 0.0:
		fr = -fr
	var rb := esq.get_bone_global_rest(b).basis.orthonormalized().inverse()
	var c: Vector3 = (rb * cima).normalized() # no espaço do osso do peito
	var dr: Vector3 = (rb * dir).normalized() # para o lado direito do corpo
	var fora: Vector3 = (rb * -fr).normalized() # para fora das costas
	dr = (dr - fora * dr.dot(fora)).normalized()
	c = fora.cross(dr).normalized() if fora.cross(dr).dot(c) > 0.0 else -fora.cross(dr).normalized()
	var meio: Vector3 = c * X_CENTRO
	# cajado: +Y do modelo vai da ponteira (origem) até a chama
	var ec: float = caj.basis.get_scale().y
	var uc: Vector3 = (c * cos(X_ANGULO_CAJADO) + dr * sin(X_ANGULO_CAJADO)).normalized()
	var comp: float = 1.105 * ec
	caj.transform = Transform3D(_base_arma(uc, fora).scaled(Vector3.ONE * ec), meio + fora * X_FUNDO - uc * comp * X_CAJADO_FIO)
	# espada: origem no cabo, +Y para a ponta (lâmina para baixo)
	var es: float = esp.basis.get_scale().y
	var us: Vector3 = (c * cos(X_ANGULO) - dr * sin(X_ANGULO)).normalized()
	esp.transform = Transform3D(_base_arma(-us, fora).scaled(Vector3.ONE * es), meio + fora * (X_FUNDO + X_ESPADA_FORA) + us * X_CABO)
	colisor_espada(esq, esp)

# Coletando (minerando ou cortando lenha; André 2026-11-06: "a arma fica flutuando do meu lado, tem que ir para as
# costas e ficar cruzada"): o mesmo X das costas do montado, com a picareta ou o machado nas mãos. Com capa as duas
# vão 9 cm para fora, por cima do pano (Armadura.costas).
func armas_cruzadas(esq: Skeleton3D, esp: Node3D, caj: Node3D) -> void:
	armas_montado(esq, esp, caj)
	var capa := esq.get_node_or_null("Armadura_capa") != null
	for a in [esp, caj]:
		a.set_meta("afastada", 0.0)
		Armadura.costas(esq, a, capa)

# cajado na mão (modo magia): não quando escala, monta, nada ou coleta (aí ele vai para as costas)
func cajado_na_mao() -> bool:
	return h.modo == "Magia" and mov.esc == null and montaria == null and not _nadando and (trabalho == null or trabalho.coletando == null)

# base com +Y ao longo da arma e o lado chato (+Z) virado para fora das costas
func _base_arma(y: Vector3, fora: Vector3) -> Basis:
	var z: Vector3 = (fora - y * fora.dot(y)).normalized()
	return Basis(y.cross(z).normalized(), y, z)

# Montado: a lâmina vira um colisor (cápsula de 4 cm) para o cabelo (molas) cair por fora dela, como no site.
# esp = null tira o colisor (a pé a espada volta para a mão ou para o lugar de sempre nas costas)
func colisor_espada(esq: Skeleton3D, esp) -> void:
	var sim: SpringBoneSimulator3D = null
	for c in esq.get_children():
		if c is SpringBoneSimulator3D:
			sim = c
			break
	if sim == null:
		return
	var col = sim.get_node_or_null("ColisorEspada")
	if esp == null:
		if col:
			col.queue_free()
			col.name = "ColisorEspada_fora"
		return
	if col == null:
		col = SpringBoneCollisionCapsule3D.new()
		col.name = "ColisorEspada"
		col.radius = 0.04
		sim.add_child(col)
	var t: Transform3D = esp.transform # no espaço do osso do peito (a espada está presa nele)
	var k: float = t.basis.get_scale().y
	col.bone_name = "J_Bip_C_UpperChest"
	col.position_offset = t * Vector3(0, 0.56, 0) # meio da lâmina (de 0,2 a 0,92 da espada)
	col.rotation_offset = t.basis.orthonormalized().get_rotation_quaternion()
	col.height = 0.72 * k + 0.08

# sobe ou desce do lobo (o servidor também: Simulacao.montar); a pé de novo, as armas voltam para o modo de antes
func montar_lobo(v: bool, avisar_servidor := true) -> void:
	if v == (montaria != null):
		return
	if v:
		montaria = Montaria.new(self, "lobo", heroi, heroi_esq)
		mov.montado = Montaria.DADOS.lobo
		mov.manobra = null
		acao = {}
		h.pend = null
		heroi_anim.play("parada", 0.2)
		sons.tocar("pano", -6.0)
	else:
		montaria.remover()
		montaria = null
		mov.montado = {}
	armar(h.modo)
	hud.ligar_botao("montar", v)
	if avisar_servidor:
		rede("montar")

func criar_inimigo(id: String, pos: Vector3, nome := "Inimigo", escala := 1.0) -> Dictionary:
	var no := modelo(id)
	no.position = pos
	no.scale *= escala
	if armas_lugar.has(id): # humano (VRoid) luta de espada; monstro do Bestiário luta com garra e soco
		prender(esqueleto(no), nova_arma("espada", false), armas_lugar[id].espadaMao)
	elif MIXAMO.has(id):
		estilo_mixamo(no, MIXAMO[id])
	else:
		contorno(no, 0.012)
	var e := {"no": no, "anim": no.find_child("AnimationPlayer", true, false), "vida": D.INIMIGO.vida, "centro": pos,
		"estado": "vagar", "t": randf() * 3.0, "alvo": pos, "cd": 0.0, "golpe": -1.0, "vida_max": D.INIMIGO.vida, "tipo": id,
		"parado": 0.0, "lento": 0.0, "lento_k": 0.0, "vuln": 0.0, "vuln_k": 0.0, "puxao": Vector3.ZERO, "puxao_t": 0.0}
	e.barra = barra_vida(no, nome, Color(0.85, 0.25, 0.2))
	nome_legivel(no)
	# com 10 clareiras no mapa: o corpo some a LONGE_INIMIGO m e o nome e a barra a NOME_LONGE m (atravessavam o mapa)
	for g in no.find_children("*", "GeometryInstance3D", true, false):
		g.visibility_range_end = NOME_LONGE if (g is Label3D or g.get_parent() == no) else LONGE_INIMIGO
	if MIXAMO.has(id): # nome e barra acima da cabeça (os do Mixamo são bem mais altos)
		e.alto = float(MIXAMO[id].alto) * escala
	inimigos.append(e)
	return e

# Monstros do Mixamo (pedido do André 2026-11-03; receita da direção de arte, Warrok v2 2026-11-04): shader próprio
# (monstro.gdshader: 3 faixas de luz, borda quente, olhos acesos) e contorno mais grosso (alto em m: nome e barra).
const MIXAMO := {"warrok": {"alto": 2.55, "contorno": 0.02}, "maw": {"alto": 2.85, "contorno": 0.02, "olho": "9cff5a"},
	"pumpkinhulk": {"alto": 2.65, "contorno": 0.02, "olho": "ffd34a", "brilho": 1.2},
	# bosses de mundo com modelo próprio (André 2026-11-11): Titã do Quimera e dragão da Quaternius (client/exportar-godot/bosses-modelos.js)
	"tita": {"alto": 2.4, "contorno": 0.02, "olho": "ffa31a", "brilho": 2.2}, "dragao": {"alto": 2.2, "contorno": 0.015, "olho": "ffd34a"}}
const CHEFES := ["chefe", "warrok", "tita", "dragao"] # chefe: não voa longe, não é puxado, sofre metade do controle (TIPOS_INIMIGO.chefe)
var _shader_monstro: Shader
func estilo_mixamo(no: Node3D, cfg: Dictionary) -> void:
	if _shader_monstro == null:
		_shader_monstro = load("res://monstro.gdshader")
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		var k: float = snappedf(float(cfg.contorno) / max(0.0001, mi.global_transform.basis.get_scale().x), 0.0001)
		if not mat_contorno.has(k):
			var c := StandardMaterial3D.new()
			c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			c.cull_mode = BaseMaterial3D.CULL_FRONT
			c.grow = true
			c.grow_amount = k
			c.albedo_color = Color(0.1, 0.07, 0.06)
			mat_contorno[k] = c
		for i in mi.mesh.get_surface_count():
			var m = mi.get_surface_override_material(i)
			if m == null:
				m = mi.mesh.surface_get_material(i)
			if not (m is BaseMaterial3D):
				continue
			var s := ShaderMaterial.new()
			s.shader = _shader_monstro
			s.set_shader_parameter("textura", m.albedo_texture)
			s.set_shader_parameter("borda_forca", float(cfg.get("borda", 0.15))) # meio-termo (André achou a v3 colorida demais)
			if m.emission_texture: # o pintar() desliga a emissão dos personagens, mas a textura dos olhos fica
				s.set_shader_parameter("brilho", m.emission_texture)
				s.set_shader_parameter("brilho_forca", float(cfg.get("brilho", 0.6)))
			s.next_pass = mat_contorno[k]
			mi.set_surface_override_material(i, s)
	# olhos (direção de arte, Warrok v3): o olho do modelo é minúsculo; um ponto de brilho de 5 cm em cada (nós olho_e e
	# olho_d presos no osso da cabeça, feitos pelo converter-mixamo.html), amarelo #ffcc40, emissão 2, sem sombra
	for o in no.find_children("olho_*", "", true, false):
		var p := MeshInstance3D.new()
		var esf := SphereMesh.new()
		var k: float = 1.0 / max(0.0001, o.global_transform.basis.get_scale().x)
		esf.radius = 0.025 * k
		esf.height = 0.05 * k
		esf.radial_segments = 8
		esf.rings = 4
		var mb := StandardMaterial3D.new()
		mb.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mb.albedo_color = Color(str(cfg.get("olho", "ffcc40")))
		mb.emission_enabled = true
		mb.emission = mb.albedo_color
		mb.emission_energy_multiplier = 2.0
		esf.material = mb
		p.mesh = esf
		p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		o.add_child(p)

# contorno escuro de desenho nos monstros (como o MToon da Ruiva): casca um pouco maior, só o lado de trás
var mat_contorno := {}
func contorno(no: Node3D, metros: float) -> void:
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		var k: float = snappedf(metros / max(0.0001, mi.global_transform.basis.get_scale().x), 0.0001)
		if not mat_contorno.has(k):
			var c := StandardMaterial3D.new()
			c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			c.cull_mode = BaseMaterial3D.CULL_FRONT
			c.grow = true
			c.grow_amount = k
			c.albedo_color = Color(0.1, 0.07, 0.06)
			mat_contorno[k] = c
		for i in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(i)
			if m is BaseMaterial3D and m.next_pass == null and m.transparency == BaseMaterial3D.TRANSPARENCY_DISABLED: # mecha de pelo (lobo): sem contorno
				var n: BaseMaterial3D = m.duplicate()
				n.next_pass = mat_contorno[k]
				mi.set_surface_override_material(i, n)

# XP do monstro: sobe com o nível do campo e cai quando o herói passou muito dele (xpDoInimigo de shared/progresso.js)
func xp_do_inimigo(e: Dictionary) -> int:
	var N: Dictionary = P.dados.get("nivelInimigo", {})
	var nv := int(e.get("nivel", 1))
	var base: float = float(P.dados.xpInimigo.get(e.tipo, 5)) * (1.0 + float(N.get("xp", 0.0)) * max(0, nv - 1))
	if N.has("xpSobe"): # diferença de nível igual ao Quimera (xpNivel de shared/progresso.js)
		var d: int = nv - int(P.prog.nivel)
		if d >= 2:
			base *= min(float(N.xpMax), 1.0 + float(N.xpSobe) * (d - 1))
		else:
			base *= clampf(1.0 - float(N.xpCai) * (-d - 2), float(N.xpMin), 1.0)
			if N.has("xpAlem"): # sem limite de nível: o corte continua além do piso (André 2026-11-09)
				base *= pow(float(N.xpAlem), max(0, -d - int(N.xpAlemDe)))
	else: # dados antigos sem os números do Quimera
		var sobra: float = int(P.prog.nivel) - nv - float(N.get("folga", 99))
		if sobra > 0.0:
			base *= max(float(N.get("min", 0.1)), 1.0 - float(N.get("perde", 0.15)) * sobra)
	return max(1, roundi(base))

# Diferença de nível como no Quimera (danoMonstroNivel, tetoMonstroNivel e golpeHeroiNivel de shared/progresso.js).
# d = nível do monstro - nível do herói. Sem os números (dados antigos) tudo fica 1.
func _desconto_abaixo(N: Dictionary, d: int) -> float:
	return max(float(N.danoAbaixoMin), 1.0 - float(N.danoAbaixo) * -d) if d < 0 else 1.0

func dano_monstro_nivel(nv: int) -> float:
	var N: Dictionary = P.dados.get("nivelInimigo", {})
	if not N.has("danoAcima"):
		return 1.0
	var d: int = nv - int(P.prog.nivel)
	return (1.0 + float(N.danoAcima) * max(0, d)) * _desconto_abaixo(N, d)

func teto_monstro_nivel(nv: int, chefe: bool) -> float:
	var N: Dictionary = P.dados.get("nivelInimigo", {})
	if not N.has("teto"):
		return 99.0
	return float(N.tetoChefe if chefe else N.teto) * _desconto_abaixo(N, nv - int(P.prog.nivel))

func golpe_heroi_nivel(nv: int) -> float:
	var N: Dictionary = P.dados.get("nivelInimigo", {})
	if not N.has("golpeFolga"):
		return 1.0
	var d: int = nv - int(P.prog.nivel)
	if d > int(N.golpeFolga):
		return max(float(N.golpeMin), 1.0 - float(N.golpeCai) * (d - int(N.golpeFolga)))
	if d < 0:
		return min(float(N.golpeMax), 1.0 + float(N.golpeSobe) * -d)
	return 1.0

# cor do nome pelo nível (Quimera): cinza = fácil, verde = no seu nível, vermelho = mais forte que você
func cor_nivel(nv: int) -> Color:
	var N: Dictionary = P.dados.get("nivelInimigo", {})
	var d: int = nv - int(P.prog.nivel)
	if d <= int(N.get("corFacil", -3)):
		return Color(0.66, 0.69, 0.66)
	if d >= int(N.get("corForte", 2)):
		return Color(1.0, 0.42, 0.35)
	return Color(0.55, 1.0, 0.48)

var _nivel_cores := -1
func colorir_niveis() -> void: # quando o herói sobe de nível, os nomes dos monstros trocam de cor
	if _nivel_cores == int(P.prog.nivel):
		return
	_nivel_cores = int(P.prog.nivel)
	for e in inimigos:
		if not e.has("nivel") or e.get("treino", false):
			continue
		for l in e.no.get_children():
			if l is Label3D:
				l.modulate = cor_nivel(int(e.nivel))
				break

func criar_npc(id: String, pos: Vector3, nome: String, info := {}) -> void:
	var no := modelo(id)
	no.position = pos
	no.position.y = terreno.altura(pos.x, pos.z) if terreno else 0.0
	no.rotation.y = float(info.get("ry", randf() * TAU))
	barra_vida(no, nome, Color(0, 0, 0, 0))
	# nome do NPC com 14 px na Alegreya (direção de arte: estava pequeno e borrado)
	for l in no.get_children():
		if l is Label3D:
			l.font = load("res://fontes/AlegreyaSans-Bold.ttf")
			l.pixel_size = 0.00034 * 1.5
			l.offset = Vector2(0, 52.0 / 1.5)
	var ap := {}
	if (str(info.get("id", "")) in TINGIR_NPC or info.get("vila") != null) and info.get("tinta") is Dictionary:
		var t: Dictionary = info.tinta
		ap = {"cabelo": t.get("cabelo"), "roupa": t.get("roupa"), "calca": t.get("calca"), "altura": float(info.get("escala", 1.0))}
		Aparencia.aplicar(no, ap)
	no.set_meta("pano_outro", true) # capa de NPC: pano de verdade só nas mais perto da câmera (pano_capa.gd)
	VisualNpc.vestir(no, str(info.get("id", "")), info) # roupa de ofício (avental e martelo do ferreiro) e de fantasia
	# arma do NPC (André 2026-11-05: guerreiros e magos, nada moderno): espada ou cajado nas costas, ou cajado na mão
	var arma := str(info.get("arma", ""))
	var esq_npc := esqueleto(no)
	if arma != "" and esq_npc and armas_lugar.has(id):
		var tipo := "espada" if arma == "espada" else "cajado"
		var lugar = lugar_armas(id).get({"espada": "espadaCostas", "cajado": "cajadoCostas", "cajado_mao": "cajadoMao"}.get(arma, ""))
		if lugar is Dictionary:
			prender(esq_npc, nova_arma(tipo), lugar)
	npcs.append({"aparencia": ap, "modelo": id, "no": no, "funcao": str(info.get("funcao", "")), "id": str(info.get("id", id)), "info": info,
		"nome": str(info.get("nome", nome)), "acoes": info.get("acoes", []), "falas": info.get("falas", []), "missao": str(info.get("missao", ""))})

# perto da Rosa, a comerciante? (o servidor confere a mesma distância para comprar e vender)
func perto_da_loja() -> bool:
	for n in npcs:
		if n.funcao == "loja" and Vector2(n.no.position.x - heroi.position.x, n.no.position.z - heroi.position.z).length() < float(P.dados.lojaDistancia) - 0.3:
			return true
	return false

# perto de quem compra itens (a Rosa ou o Tomás, o ferreiro)? O servidor confere o mesmo (pertoDeQuemCompra)
func perto_de_quem_compra() -> bool:
	if perto_da_loja():
		return true
	for n in npcs:
		if "vender" in n.get("acoes", []) and Vector2(n.no.position.x - heroi.position.x, n.no.position.z - heroi.position.z).length() < float(P.dados.lojaDistancia) - 0.3:
			return true
	return false

func perto_do_npc(funcao: String, metros: float) -> bool:
	for n in npcs:
		if n.funcao == funcao and Vector2(n.no.position.x - heroi.position.x, n.no.position.z - heroi.position.z).length() < metros:
			return true
	return false

# preço do Mestre Ivo (RESET_BUILD de shared/dados.js, o mesmo de Simulacao.custoReset)
func custo_reset() -> int:
	if P.hist_info.get("resetGratis", false) == true: # história v2 (capítulo 10): a Mestra Iara reseta de graça uma vez
		return 0
	var R: Dictionary = mundo.get("resetBuild", {"minimo": 50, "porNivel": 10})
	return max(int(R.minimo), int(R.porNivel) * int(P.prog.nivel))

# botão de poção da HUD: a primeira pilha daquela poção na bolsa, pelo mesmo caminho do "Usar" da bolsa (menu.acao_item)
func beber_pocao(k: String) -> void:
	var i := -1
	for j in P.prog.mochila.size():
		var it = P.prog.mochila[j]
		if it != null and it.k == k:
			i = j
			break
	if i < 0:
		hud.aviso("Sem %s na bolsa" % ("poção de vida" if k == "pocao" else "poção de mana"))
		hud.negar(k)
		return
	menu.acao_item({"acao": "usar", "i": i})

# recarga da poção (POCAO_RECARGA de shared/dados.js; o servidor confere a mesma)
func recarga_pocao() -> float:
	return float(P.dados.get("pocaoRecarga", 10))

# poção da mochila: confere se vale a pena; sem internet já recupera aqui (online quem aplica é o servidor)
func usar_pocao(it: Dictionary) -> bool:
	if h.morto > 0.0:
		return false
	var u: Dictionary = P.dados.itens[it.k].get("usar", {})
	var rc: float = recargas.get("it:" + str(it.k), 0.0)
	if rc > 0.0 and not P.dados.itens[it.k].get("comida", false):
		hud.aviso("Espere %d s para outra %s" % [int(ceil(rc)), str(P.dados.itens[it.k].nome).to_lower()])
		hud.negar(it.k)
		return false
	if P.dados.itens[it.k].get("comida", false): # prato do fogão (2026-11-07): o servidor confere vida, mana e vigor
		if u.has("vida") and h.vida < P.st.vidaMax:
			var nc: float = min(P.st.vidaMax - h.vida, round(P.st.vidaMax * float(u.vida)))
			fx.cura(heroi)
			fx.numero(heroi.position, nc, Color("7dffa0"))
			if not on():
				h.vida += nc
		if u.has("mana") and not on():
			h.mana = min(P.st.manaMax, h.mana + P.st.manaMax * float(u.mana))
		return true
	if u.has("vida"):
		if h.vida >= P.st.vidaMax:
			hud.aviso("A vida já está cheia")
			return false
		var n: float = min(P.st.vidaMax - h.vida, round(P.st.vidaMax * float(u.vida)))
		fx.cura(heroi)
		fx.numero(heroi.position, n, Color("7dffa0"))
		if not on():
			h.vida += n
	if u.has("mana"):
		if h.mana >= P.st.manaMax:
			hud.aviso("A mana já está cheia")
			return false
		if not on():
			h.mana = min(P.st.manaMax, h.mana + P.st.manaMax * float(u.mana))
	recargas["it:" + str(it.k)] = recarga_pocao() # o mesmo tempo do servidor: o botão da HUD mostra a contagem
	return true

# ouro e itens que caíram do monstro: sobem do corpo dele (cor da raridade)
func mostrar_drop(pos: Vector3, ouro: int, itens: Array) -> void:
	# uma linha embaixo da outra, saindo com 0,15 s de diferença (direção de arte: sem aviso repetido no topo)
	var linhas := []
	if ouro > 0:
		linhas.append(["+%d ouro" % ouro, Color("ffd36a")])
	for it in itens:
		var r := int(it.get("r", -1))
		linhas.append([str(it.nome), Color(P.dados.raridades[r].cor) if r >= 0 else Color("e8f0ff")])
	for i in linhas.size():
		fx.texto(pos - Vector3(0, 0.36 * i, 0), linhas[i][0], linhas[i][1], 0.15 * i)

# nome do monstro legível no celular (direção de arte): Alegreya 1,5x como os NPCs (~21 px numa tela de 576),
# contorno de ~2 px e letra em MSDF com mipmaps (borda lisa em qualquer tamanho, sem serrilhado)
var _fonte_nome: FontFile
func fonte_nome() -> FontFile:
	if _fonte_nome == null:
		_fonte_nome = (load("res://fontes/AlegreyaSans-Bold.ttf") as FontFile).duplicate()
		_fonte_nome.multichannel_signed_distance_field = true
		_fonte_nome.msdf_pixel_range = 16
		_fonte_nome.msdf_size = 64
		_fonte_nome.generate_mipmaps = true
	return _fonte_nome

func nome_legivel(no: Node3D) -> void:
	for l in no.get_children():
		if l is Label3D:
			l.font = fonte_nome()
			l.pixel_size = 0.00034 * 1.5
			l.offset = Vector2(0, 52.0 / 1.5)
			l.outline_size = 7 # 7 px da letra de 72 = uns 2 px na tela
			l.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS

# nome e barra de vida em cima da cabeça
func barra_vida(no: Node3D, nome: String, cor: Color) -> MeshInstance3D:
	var l := Label3D.new()
	l.text = nome
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	# tamanho fixo na tela (uns 14 px de letra numa tela de 576 de altura), não cresce quando a câmera chega perto
	l.fixed_size = true
	l.font_size = 72 # letra grande em pixel bem pequeno: fica nítida
	l.outline_size = 16
	l.pixel_size = 0.00034
	l.offset = Vector2(0, 52) # em cima da barra
	l.modulate = Color(1, 0.93, 0.8)
	l.position = Vector3(0, 1.95, 0)
	l.visibility_range_end = 60.0 # de longe (vista do alto) os nomes não se empilham lá na vila; monstros: NOME_LONGE
	no.add_child(l)
	if cor.a == 0:
		return null
	var fundo := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.1, 0.009) # 60 x 5 px na tela (tamanho fixo, como o nome)
	fundo.mesh = q
	var mf := StandardMaterial3D.new()
	mf.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mf.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mf.billboard_keep_scale = true
	mf.fixed_size = true
	mf.no_depth_test = true
	mf.albedo_color = Color(0, 0, 0, 0.6)
	mf.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fundo.material_override = mf
	fundo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	fundo.position = Vector3(0, 1.95, 0)
	no.add_child(fundo)
	var barra := MeshInstance3D.new()
	barra.mesh = q
	var mb: StandardMaterial3D = mf.duplicate()
	mb.albedo_color = cor
	mb.render_priority = 1
	barra.material_override = mb
	barra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	barra.position = Vector3(0, 1.95, 0)
	no.add_child(barra)
	return barra

# cabelo, saia e acessórios do VRoid (ossos J_Sec_...) balançam com mola, como as spring bones do site
func molas(no: Node) -> void:
	var esq := esqueleto(no)
	if esq == null:
		return
	var cadeias := []
	for i in esq.get_bone_count():
		var nome := esq.get_bone_name(i)
		var pai := esq.get_bone_parent(i)
		if nome.begins_with("J_Sec_") and (pai < 0 or not esq.get_bone_name(pai).begins_with("J_Sec_")):
			var fim := i
			while true:
				var filhos := esq.get_bone_children(fim)
				if filhos.is_empty():
					break
				fim = filhos[0]
			if fim != i:
				cadeias.append([i, fim])
	if cadeias.is_empty():
		return
	var sim := SpringBoneSimulator3D.new()
	esq.add_child(sim)
	sim.setting_count = cadeias.size()
	for k in cadeias.size():
		sim.set_root_bone(k, cadeias[k][0])
		sim.set_end_bone(k, cadeias[k][1])
		sim.set_stiffness(k, 1.0)
		sim.set_drag(k, 0.4)
		sim.set_gravity(k, 0.0)

# ---------- combate ----------
# dentro da Caverna da Montanha (primeira masmorra)
func na_masmorra() -> bool:
	if caverna == null:
		return false
	var c: Dictionary = terreno.dentro_caverna(heroi.position.x, heroi.position.z, heroi.position.y + 0.3)
	return not c.is_empty() and c.id == "" # só a dungeon (as cavernas do mundo grande são caminho aberto)

# algum monstro vivo a até 15 m bateu ou apanhou nos últimos segundos (a luta continua mesmo se o herói ficou sem bater)
func luta_perto() -> bool:
	for e in inimigos:
		if e.estado != "morto" and e.vida > 0.0 and maxf(float(e.get("combate", 0.0)), float(e.get("luta", 0.0))) > tempo and e.no.position.distance_to(heroi.position) < 15.0:
			return true
	return false

# algum chefe (Imp Chefe, Warrok) bateu ou apanhou nos últimos segundos: a música de combate vira a de chefe
func luta_com_chefe() -> bool:
	for e in inimigos:
		if (e.tipo in CHEFES or str(e.get("hc", "")) != "") and e.vida > 0.0 and float(e.get("combate", 0.0)) > tempo and e.no.position.distance_to(heroi.position) < 30.0:
			return true
	return false

func inimigo_em(pos: Vector3, raio: float):
	for e in inimigos:
		if e.estado != "morto" and Vector2(e.no.position.x - pos.x, e.no.position.z - pos.z).length() < raio + 0.35 and pos.y < e.no.position.y + 2.2:
			return e
	return null

func mais_perto(pos: Vector3, max_d: float):
	var melhor = null
	var md := max_d
	for e in inimigos:
		if e.estado == "morto":
			continue
		var d: float = e.no.position.distance_to(pos)
		if d < md:
			md = d
			melhor = e
	return melhor

# hab: a skill que acertou (crítico pela Destreza e efeitos: atordoa, congela, lento, vulnerável), como Simulacao.ferir
func ferir(e: Dictionary, dmg: float, de: Vector3, hab = null) -> void:
	if e.estado == "morto":
		return
	if on(): # online: quem acerta e quanto tira é o servidor; o tranco, o flash e a congelada saem na hora aqui
		var forte_on: bool = h.golpe_forte or not (hab is Dictionary and hab.has("combo"))
		impacto_golpe(e.no.position, forte_on, false, hab is Dictionary and hab.has("combo") and h.modo == "Espada", tiro_basico(hab))
		piscar(e.no)
		combate.reacao(e.no, de, forte_on)
		return
	if e.get("treino", false):
		ferir_treino(e, dmg, de, hab)
		return
	trabalho.combate()
	dmg *= randf_range(0.85, 1.15) # como no Quimera: ±15% e crítico ×2
	var crit: bool = randf() < P.st.critico
	if crit:
		dmg *= 2.0
	if e.vuln > tempo:
		dmg *= 1.0 + e.vuln_k
	if e.has("nivel"): # diferença de nível (Quimera)
		dmg *= golpe_heroi_nivel(int(e.nivel))
	if h.get("contra_ate", 0.0) > tempo: # contra-ataque depois da esquiva (como Simulacao.ferir)
		dmg *= float(D.COMBATE.contraK)
		crit = true
		h.contra_ate = 0.0
	dmg = max(1.0, round(dmg))
	e.vida -= dmg
	e.combate = tempo + 5.0 # nome aparece enquanto está em combate
	fx.numero(e.no.position, dmg, Color(1, 0.72, 0.25) if crit else Color(1, 0.95, 0.6), crit)
	var basico_hab: bool = hab is Dictionary and hab.has("combo")
	impacto_golpe(e.no.position, h.golpe_forte or not basico_hab, crit, basico_hab and h.modo == "Espada", tiro_basico(hab))
	piscar(e.no)
	# resistência: muitos golpes seguidos e o monstro fica firme (aguenta e revida), como no servidor
	if tempo - e.get("golpe_t", -9.0) > D.COMBATE.firmeJanela:
		e.golpes = 0
	e.golpe_t = tempo
	e.golpes = e.get("golpes", 0) + 1
	if e.vida > 0.0 and e.golpes >= int(D.COMBATE.firmeGolpes.get(e.tipo, 6)) and e.get("firme", 0.0) <= tempo and e.parado <= tempo:
		e.firme = tempo + D.COMBATE.firmeDur
		e.golpes = 0
		e.cd = min(e.cd, 0.25)
		combate.firme(e.no, D.COMBATE.firmeDur)
	var firme: bool = e.get("firme", 0.0) > tempo
	combate.reacao(e.no, de, h.golpe_forte or not basico_hab)
	e.barra.scale.x = max(0.001, e.vida / e.vida_max)
	var empurra: Vector3 = (e.no.position - de)
	empurra.y = 0
	var metros: float = float(hab.get("empurra", 0.25)) if hab is Dictionary else 0.25
	if empurra.length() > 0.01 and not (e.tipo in CHEFES) and not firme: # o inimigo voa para longe (em 0,22 s)
		e.puxao = empurra.normalized() * metros / 0.22
		e.puxao_t = 0.22
	if e.vida <= 0:
		e.estado = "morto"
		e.t = D.INIMIGO.renascer
		e.morreu = tempo
		e.parado = 0.0
		e.anim.speed_scale = 1.0
		e.anim.play("morrer", 0.1)
		e.golpe = -1.0
		if not (e.tipo in CHEFES) and empurra.length() > 0.01: # o golpe final joga o corpo para trás
			e.puxao = empurra.normalized() * D.COMBATE.voaMorte / 0.35
			e.puxao_t = 0.35
		combate.morreu(e.no)
		if SOM_MORTE_MOB: # teste do André 2026-11-08: sem o estalo seco quando o monstro morre
			sons.tocar("morte", -2.0, 0.1, e.no.position)
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = false
		e.barra.visible = false
		var subiu: String = P.ganhar_xp(xp_do_inimigo(e))
		if subiu != "":
			h.vida = P.st.vidaMax
			h.mana = P.st.manaMax
			hud.aviso(subiu)
			fx.subir_nivel(heroi)
		return
	if hab is Dictionary:
		var chefe: float = 0.5 if e.tipo in CHEFES else 1.0
		if hab.has("lento"): # no chefe lentidão e Quebrado valem metade
			e.lento = tempo + hab.lento.dur
			e.lento_k = hab.lento.k * chefe
		if hab.has("vulneravel"):
			e.vuln = tempo + hab.vulneravel.dur
			e.vuln_k = hab.vulneravel.k * chefe
		for k in ["atordoa", "congela"]:
			if hab.has(k) and not (k == "atordoa" and hab.get("tipo") == "esmagar" and e.tipo in CHEFES):
				e.parado = max(e.parado, tempo + hab[k] * chefe)
				e.golpe = -1.0
				fx.status(e.no, k, hab[k] * chefe)
				if k == "congela":
					e.anim.speed_scale = 0.0
	if e.parado > tempo or firme: # atordoado, congelado ou firme: não para o que está fazendo
		return
	e.golpe = -1.0 # apanhou no meio do preparo: o golpe dele foi cortado
	e.estado = "apanhar"
	e.t = 0.45
	e.anim.play("apanhar", 0.05, 1.6)

# ---------- peso do golpe: congelada, tremida, flash, som e vibração ----------
# Golpe que acertou (uma vez por quadro, mesmo pegando vários inimigos). forte = último do combo ou skill.
var _impacto_t := -9.0
# tiro_basico: a Faísca do cajado acertou. O herói continua andando enquanto atira, então aqui NÃO congela o jogo
# nem treme a câmera (André 2026-11-03: "correndo e trava, parece lag"); fica o som, o flash, o número e um toque leve.
const SOM_ACERTO_MAGIA := false # false = magia acerta sem o som genérico de golpe (teste do André 2026-11-08)
const SOM_MORTE_MOB := false # false = monstro morre sem o som "morte" (estalo seco). Para voltar, true
var _faisca_t := -9.0 # último acerto da Faísca: a confirmação do servidor não toca outro golpe por cima
func impacto_golpe(pos: Vector3, forte: bool, crit: bool, lamina: bool, tiro_basico := false) -> void:
	if _impacto_quadro == Engine.get_process_frames():
		return
	_impacto_quadro = Engine.get_process_frames()
	_impacto_t = tempo
	var pesado := forte or crit
	if tiro_basico:
		# o som do acerto da Faísca é o impacto de fogo (faisca_acerto, efeitos.gd); o "acerto" genérico tapava ele (André 2026-11-07)
		_faisca_t = tempo
		vibrar(18 if pesado else 12)
		return
	parar_golpe(HITSTOP_FORTE if pesado else HITSTOP)
	cam.tremer(TREME_FORTE if pesado else TREME)
	# teste do André (2026-11-08): skills de mago sem o "acerto" genérico ("saco duro batendo"); ficam os sons próprios
	# de cada magia (explosão, gelo, raio...). Para voltar como era, troque SOM_ACERTO_MAGIA para true.
	if SOM_ACERTO_MAGIA or h.modo != "Magia":
		sons.tocar("acerto_forte" if pesado else "acerto", -1.0 if pesado else -3.0, 0.1, pos)
	if lamina:
		sons.tocar("corte", -7.0, 0.1, pos)
		# faíscas do corte no ponto do golpe
		var p := pos + Vector3(0, 1.05, 0) - frente() * 0.25
		fx.surto(p.x, p.y, p.z, 14 if pesado else 9, "ffffff", "ffd27a", 6.0 if pesado else 4.5, 0.08)
		fx.marca_corte(p, heroi.rotation.y, pesado)
	vibrar(40 if pesado else 22)

# a Faísca (ataque básico do cajado) é tiro de longe feito andando: o acerto dela não congela o jogo
func tiro_basico(hab) -> bool:
	return hab is Dictionary and str(hab.get("tipo", "")) == "basicoMagia"

# tudo para por um instante (Engine.time_scale), como nos jogos de ação; volta pelo relógio de verdade
func parar_golpe(seg: float) -> void:
	_hitstop_ate = max(_hitstop_ate, Time.get_ticks_usec() / 1000000.0 + seg)
	Engine.time_scale = 0.05

# folhagem entre a câmera e o peito do herói (cápsula de 0,8 m) fica transparente: alfa 0,25 em 0,15 s,
# volta em 0,4 s. Os troncos são outra malha e continuam sólidos. (direção de arte, pacote A)
const FOLHA_RAIO := 0.8
const FOLHA_ALFA := 0.25
const TRONCO_PERTO := 1.1 # m: tronco a menos disso da câmera (do lado, tapando meia tela) também apaga
# troncos das árvores (opacos, finos e altos, em cima de uma árvore do mapa): entram no mesmo apagar das copas,
# assim a câmera não fica atrás de um tronco sem precisar chegar perto (o André não quer a câmera colando no herói)
var _n_troncos := 0
func achar_troncos(raiz: Node) -> void:
	var arv: Array = []
	for a in mundo.get("coletaveis", []):
		if str(a.tipo) == "arvore" and str(a.id).begins_with("a"): # as da mata (m0...) são MultiMesh: têm o apagar delas
			arv.append(Vector2(float(a.x), float(a.z)))
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.mesh.get_surface_count() == 0:
			continue
		var m0 = mi.mesh.surface_get_material(0)
		if not (m0 is BaseMaterial3D) or m0.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
			continue
		var bb: AABB = mi.global_transform * mi.mesh.get_aabb()
		if bb.size.y < 2.0 or bb.size.y > 9.0 or bb.size.x > 6.0 or bb.size.z > 6.0: # tronco com os galhos
			continue
		var c := Vector2(bb.get_center().x, bb.get_center().z)
		for a in arv:
			if c.distance_to(a) < 1.6:
				folhas.append([mi, null, 0.0, true])
				_n_troncos += 1
				break

func folhagem_na_frente(dt: float) -> void:
	if camera == null or heroi == null:
		return
	copas_da_mata_na_frente(dt)
	var a: Vector3 = camera.global_position
	var b: Vector3 = heroi.global_position + Vector3(0, 1.2, 0)
	for f in folhas:
		var mi: MeshInstance3D = f[0]
		if not is_instance_valid(mi):
			continue
		if f[1] == null:
			f[1] = (mi.global_transform * mi.mesh.get_aabb()).grow(FOLHA_RAIO)
		var tapa: bool = f[1].intersects_segment(a, b) != null
		if not tapa and f.size() > 3: # tronco colado na câmera, de lado
			var bb: AABB = f[1]
			var cxz := Vector2(bb.get_center().x, bb.get_center().z)
			tapa = cxz.distance_to(Vector2(a.x, a.z)) < TRONCO_PERTO + FOLHA_RAIO and (Vector3(cxz.x, a.y, cxz.y) - a).dot(b - a) > 0.0
		var quer: float = (1.0 - FOLHA_ALFA) if tapa else 0.0
		var atual: float = f[2] if f.size() > 2 else 0.0
		if atual == quer:
			continue
		atual = move_toward(atual, quer, dt * (1.0 - FOLHA_ALFA) / (0.15 if tapa else 0.4))
		if f.size() < 3:
			f.append(atual)
		f[2] = atual
		# alfa de verdade (sem o pontilhado do dither): cópia do material só enquanto a copa está apagando
		if atual > 0.0:
			if mi.material_override == null:
				var base: BaseMaterial3D = mi.mesh.surface_get_material(0)
				var mt: BaseMaterial3D = base.duplicate()
				mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
				mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_DISABLED
				mi.material_override = mt
			var cor: Color = mi.mesh.surface_get_material(0).albedo_color
			mi.material_override.albedo_color = Color(cor, cor.a * (1.0 - atual))
		else:
			mi.material_override = null

# Mata (direção de arte): árvore a menos de 2,5 m da câmera, ou com a copa entre a câmera e o herói, some INTEIRA
# (tronco, galhos e copa) num fade de 0,15 s, sem pontilhado: a cópia dela no MultiMesh encolhe para zero e no lugar
# entra uma cópia solta com alfa de verdade, que apaga; quando sai da frente, a cópia volta e a do MultiMesh também.
func copas_da_mata_na_frente(dt := 0.016) -> void:
	if arvores_mata.is_empty():
		return
	var a: Vector3 = camera.global_position
	var b: Vector3 = heroi.global_position + Vector3(0, 1.2, 0)
	var vistas := {}
	for p in [a, (a + b) * 0.5, b]:
		for k in mov.perto_na_mata(p.x, p.z):
			vistas[Vector2(k.x, k.z)] = true
	var tapam := {}
	for pos in vistas:
		var c = arvores_mata.get(pos)
		if c == null or c.get("caida", false): # derrubada (queda_arvore.gd): ela mesma cuida da cópia e de crescer de novo
			continue
		var s: float = c.s
		var perto_cam: bool = Vector2(a.x, a.z).distance_to(pos) < 2.5 + 0.32 * s
		var centro := Vector3(pos.x, 3.6 * s, pos.y)
		var na_frente: bool = Geometry3D.get_closest_point_to_segment(centro, a, b).distance_to(centro) < 2.7 * s
		var tronco: bool = Geometry3D.get_closest_point_to_segment(Vector3(pos.x, min(a.y, 2.0), pos.y), a, b).distance_to(Vector3(pos.x, min(a.y, 2.0), pos.y)) < 0.5 * s + 0.3
		if perto_cam or na_frente or tronco:
			tapam[pos] = true
	for pos in tapam:
		if not _sumindo.has(pos):
			_sumir_arvore(pos)
		_sumindo[pos].quer = 1.0
	for pos in _sumindo.keys():
		var f: Dictionary = _sumindo[pos]
		if not tapam.has(pos):
			f.quer = 0.0
		f.k = move_toward(f.k, f.quer, dt / MATA_FADE)
		for m in f.mats:
			m.albedo_color.a = (1.0 - f.k) * float(m.get_meta("alfa", 1.0))
		if f.k <= 0.0 and f.quer == 0.0:
			_voltar_arvore(pos)

func _sumir_arvore(pos: Vector2) -> void:
	var c: Dictionary = arvores_mata[pos]
	var no := Node3D.new()
	no.transform = c.t
	add_child(no)
	var mats: Array = []
	for parte in ["tronco", "copa"]:
		if not c.has(parte):
			continue
		var mesh: Mesh = _malhas_mata.get("%s_%d" % [parte, c.v])
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var mt: BaseMaterial3D = (mesh.surface_get_material(0) as BaseMaterial3D).duplicate()
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
		mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_DISABLED
		if parte == "copa":
			mt.albedo_color = mt.albedo_color * c.copa[2]
		mt.set_meta("alfa", mt.albedo_color.a)
		mi.material_override = mt
		mats.append(mt)
		no.add_child(mi)
		var mm: MultiMesh = c[parte][0]
		mm.set_instance_transform(c[parte][1], Transform3D(Basis().scaled(Vector3.ZERO), c.t.origin))
	_sumindo[pos] = {"no": no, "k": 0.0, "quer": 1.0, "mats": mats}

func _voltar_arvore(pos: Vector2) -> void:
	var c: Dictionary = arvores_mata[pos]
	for parte in ["tronco", "copa"]:
		if c.has(parte):
			c[parte][0].set_instance_transform(c[parte][1], c.t)
	_sumindo[pos].no.queue_free()
	_sumindo.erase(pos)

# câmera lenta curtinha (o tempo, não a câmera): k = velocidade (0,3 = 30%) por seg segundos de verdade
func lenta(seg: float, k: float) -> void:
	_lenta_ate = max(_lenta_ate, Time.get_ticks_usec() / 1000000.0 + seg)
	_lenta_k = k
	if Engine.time_scale > k:
		Engine.time_scale = k

func vibrar(ms: int) -> void:
	if OS.has_feature("mobile") and vibracao:
		Input.vibrate_handheld(ms)

# inimigo pisca branco por um instante quando apanha (direção de arte: no máximo 55% para branco, 0,06 s; era 85% e 0,11 s)
const FLASH_DUR := 0.06
const FLASH_MAX := 0.55
func piscar(no: Node3D) -> void:
	if not is_instance_valid(no):
		return
	var f = _flash.get(no)
	if f == null:
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(1, 1, 1, 0)
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		var malhas := []
		for mi in no.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is QuadMesh): # o corpo, não a barra de vida
				malhas.append(mi)
		f = {"mat": mat, "t": 0.0, "malhas": malhas}
		_flash[no] = f
	f.t = FLASH_DUR
	for mi in f.malhas:
		mi.material_overlay = f.mat

func _flash_passo(dt: float) -> void:
	for no in _flash.keys():
		var f: Dictionary = _flash[no]
		if f.t <= 0.0:
			continue
		f.t -= dt
		f.mat.albedo_color.a = clamp(f.t / FLASH_DUR, 0.0, 1.0) * FLASH_MAX
		if f.t <= 0.0:
			for mi in f.malhas:
				if is_instance_valid(mi): # congelado: volta para o gelo, não limpa
					mi.material_overlay = mi.get_meta("overlay_base") if mi.has_meta("overlay_base") else null

func dano_area(pos: Vector3, raio: float, dmg: float, hab = null) -> void:
	for e in inimigos.duplicate():
		if e.estado != "morto" and Vector2(e.no.position.x - pos.x, e.no.position.z - pos.z).length() < raio:
			ferir(e, dmg, pos, hab)

func dano_arco(alcance: float, arco: float, dmg: float, hab = null) -> Array:
	var frente := frente()
	var acertou := []
	for e in inimigos.duplicate():
		if e.estado == "morto":
			continue
		var d: Vector3 = e.no.position - heroi.position
		if abs(d.y) > 1.6: # em cima da pedra o golpe não alcança quem está embaixo
			continue
		d.y = 0
		if d.length() < alcance + 0.4 and (d.length() < 0.6 or frente.angle_to(d) < arco * 0.5):
			acertou.append(e.no.position)
			ferir(e, dmg, heroi.position, hab)
	return acertou

func virar_para_inimigo() -> void:
	var e = mais_perto(heroi.position, 8.0)
	if e:
		var d: Vector3 = e.no.position - heroi.position
		mov.mirar(atan2(d.x, d.z))

# para onde o herói está virado (ou virando: o golpe já mira no alvo enquanto o corpo gira)
func frente() -> Vector3:
	var r: float = mov.direcao()
	return Vector3(sin(r), 0, cos(r))

func ponto_mao() -> Vector3:
	return heroi_esq.global_transform * heroi_esq.get_bone_global_pose(mao_direita).origin

# mão esquerda (a Faísca alterna as mãos; a Bola de Fogo junta as duas)
func ponto_mao_esq() -> Vector3:
	if mao_esquerda < 0:
		return ponto_mao()
	return heroi_esq.global_transform * heroi_esq.get_bone_global_pose(mao_esquerda).origin

func comecar(nome: String, ts: float, hits: Array, ao_acertar: Callable, extra := {}) -> void:
	var dur: float = heroi_anim.get_animation(nome).length / ts
	heroi_anim.play(nome, extra.get("fade", 0.08), ts)
	acao = {"nome": nome, "t": 0.0, "dur": dur, "hits": hits.duplicate(), "feitos": 0, "fn": ao_acertar}
	acao.merge(extra)

func on() -> bool:
	return online != null and online.ligado

func rede(tipo: String, dados = null) -> void:
	if on():
		online.enviar(tipo, dados)

func pode_agir() -> bool:
	return h.morto <= 0.0 and acao.is_empty() and mov.esc == null

# Botão apertado. Se não dá para fazer agora (golpe ainda no fim, no ar, recarga quase acabando), o botão fica
# guardado um instante (fila) e sai assim que der: o combo e as skills emendam sem perder toque.
func usar(qual: String) -> void:
	if h.morto > 0.0:
		return
	if boss_mundo.preso() and (qual in ["basico", "cura", "dash", "rolar", "pular", "montar", "disparada", "coletar"] or qual.begins_with("hab")):
		return # atordoado por skill de boss: só poção
	if qual in ["pocao", "pocao_mana"]: # botões de poção da HUD (2026-11-07): não param coleta, volta nem golpe
		beber_pocao(qual)
		return
	if trabalho.coletando != null and not qual in ["coletar", "menu", "troca", "falar", "construir", "lote", "bancada", "bau", "forno", "encher"]:
		trabalho.parar(true) # qualquer ação para a coleta
	if pesca != null and pesca.ativo() and not qual in ["pescar", "menu", "troca", "falar", "encher"]:
		pesca.recolher() # Quimera: bater, pular, dash, rolar ou montar recolhe a linha
	if qual == "pescar": # beira de um lago com a vara (pesca.gd): lança, puxa no "!" e toca rápido na briga
		pesca.tocar()
		return
	if qual == "veiculo": # FASE 1 (transporte.gd): dirigir, descer, abrir o carrinho ou o navio, pôr o barquinho na água
		transporte.usar_botao()
		return
	if qual == "pegar_pack":
		transporte.pegar_pack()
		return
	# dirigindo não dá para lutar, pular, rolar, montar nem coletar (Quimera)
	if not mov.veiculo.is_empty() and (qual in ["basico", "cura", "dash", "rolar", "pular", "coletar", "montar", "disparada"] or qual.begins_with("hab")):
		hud.aviso("Desça primeiro")
		return
	if volta.ativo() and not qual in ["menu", "troca", "loja", "forja", "resetar", "falar"]:
		volta.cancelar() # atacar, pular, dash, coletar: a volta para a vila para
	if qual in ["afundar", "subir"]: # mergulho: quem age é o botão seguro (_process)
		return
	# nadando não dá para lutar nem coletar (as armas estão nas costas)
	if _nadando and (qual in ["basico", "dash", "rolar", "coletar"] or qual.begins_with("hab")):
		hud.aviso("Nadando não dá")
		return
	# montado: golpe, skill, cura, dash, rolar, pulo e coleta descem do lobo antes (como no servidor: luta a pé)
	if montaria != null and (qual in ["basico", "cura", "dash", "rolar", "pular", "coletar"] or qual.begins_with("hab")):
		montar_lobo(false)
		if qual == "pular":
			return # o pulo só desce do lobo
	if qual in ["pular", "dash", "rolar"]: # pular, dash e rolar cancelam a magia concentrada e cortam o golpe
		if acao.get("canal", false):
			cancelar_canal()
		elif acao.get("basico", false) or (acao.get("cancela", false) and acao.feitos >= acao.hits.size()):
			acao = {} # golpe que já acertou: esquiva na hora
	if _tentar(qual):
		fila = null
	elif not qual in ["troca", "menu", "coletar", "falar", "selo", "disparada", "montar", "construir", "lote", "bancada", "bau", "forno", "cama", "encher"]:
		fila = {"q": qual, "ate": tempo + (FILA_PULO if qual == "pular" else FILA_TEMPO)}

# 3ª velocidade (André 2026-11-03): o botão liga a corrida que gasta estamina (andar.gd disparada).
# Desliga tocando de novo, quando a estamina acaba (trabalho.gd) ou quando o herói para de andar.
var _parado_disparada := 0.0
const GUARDA_DEPOIS := 3.0 # s em guarda depois de golpear o ar (sem acertar ninguém não entra em combate)
var _guarda_ate := 0.0
func ligar_disparada(v: bool) -> void:
	if v and trabalho.sem_folego and montaria == null: # montado quem corre é o lobo
		hud.aviso("Sem fôlego!")
		hud.negar("disparada")
		return
	mov.disparada = v
	hud.ligar_botao("disparada", v)

func passo_disparada(dt: float, forca: float) -> void:
	if mov.disparada and (forca < 0.15 and mov.velocidade() < 0.5):
		_parado_disparada += dt
		if _parado_disparada > 0.6:
			mov.disparada = false
	else:
		_parado_disparada = 0.0
	hud.ligar_botao("disparada", mov.disparada)

# tenta fazer agora. false = ocupado (vale guardar na fila); true = fez, ou não vai dar mesmo (já avisou)
func _tentar(qual: String) -> bool:
	match qual:
		"disparada":
			ligar_disparada(not mov.disparada)
		"montar": # botão do lobo: sobe (parado ou andando, no chão) ou desce
			if rota and rota.ativo: # no "Ir para": desceu no botão segue a pé; subiu, volta a ir no lobo (rota.gd)
				rota.a_pe = montaria != null
			if montaria != null:
				montar_lobo(false)
			elif nevoa and not nevoa.liberado("lobo", true): # lobo ainda não amansado (missão do Bento): nem tenta
				hud.negar("montar")
			elif mov.esc != null or not mov.chao or not acao.is_empty() or mov.arrancada != null:
				hud.negar("montar")
			else:
				if trabalho.coletando != null:
					trabalho.parar(true)
				montar_lobo(true)
		"basico":
			# segura só se o dedo ainda está no botão (um toque que saiu da fila depois de soltar não trava a repetição)
			h.segurando = hud.segurando("basico")
			return basico()
		"troca":
			armar("Magia" if h.modo == "Espada" else "Espada")
			rede("modo", h.modo)
			mostrar_build()
			hud.aviso("Modo espada" if h.modo == "Espada" else "Modo magia")
			sons.tocar("sacar", -4.0)
		"cura":
			if h.mana < D.CURA.mana:
				hud.aviso("Mana insuficiente") # André 2026-11-07: antes não dizia nada
				return true
			if recargas.get("cura", 0.0) > FILA_TEMPO:
				return true
			if not pode_agir() or recargas.get("cura", 0.0) > 0.0:
				return false
			h.mana -= D.CURA.mana
			recargas["cura"] = D.CURA.cd
			rede("habilidade", 9)
			fx.conjura(heroi, "cura", heroi_anim.get_animation(D.CURA.anim).length / D.CURA.ts, maos)
			comecar(D.CURA.anim, D.CURA.ts, D.CURA.hits, func(_i):
				h.vida = min(P.st.vidaMax, h.vida + D.CURA.cura)
				fx.cura(heroi)
				fx.numero(heroi.position, D.CURA.cura, Color("7dffa0")))
		"pular":
			if not acao.is_empty() and not acao.get("pulo", false):
				return false
			var folego: bool = trabalho.pode(float(trabalho.E.mortal))
			var p: String = mov.pular(folego)
			if p == "":
				if not folego and not mov.chao and mov.pulos == 1:
					hud.aviso("Sem fôlego!")
				return false # no ar sem pulo sobrando: se pousar logo, pula no pouso
			if p == "mortal":
				trabalho.gastar(float(trabalho.E.mortal))
			rede("pular")
			acao = {}
			heroi_anim.play(p, 0.06, 1.2)
			sons.tocar("pano", -8.0)
			if p == "mortal":
				sons.tocar("golpe", -6.0, 0.05, null, 0.7)
		"dash":
			if recargas.get("dash", 0.0) > FILA_TEMPO:
				return true
			if recargas.get("dash", 0.0) > 0.0 or not acao.is_empty() or mov.esc != null:
				return false
			if not trabalho.pode(float(trabalho.E.dash)):
				hud.aviso("Sem fôlego!")
				return true
			var dir := direcao_joystick()
			var na_parede: bool = mov.dash(dir.x, dir.z)
			if mov.esc == null and mov.arrancada == null:
				return true # não deu (já usou o dash no ar)
			recargas["dash"] = D.MOVIMENTO.dash_cd
			trabalho.gastar(float(trabalho.E.dash))
			rede("dash")
			if not na_parede:
				fx.dash(heroi, D.MOVIMENTO.dash_tempo, false)
			heroi.rotation.y = mov.ry
		"rolar":
			if recargas.get("rolar", 0.0) > FILA_TEMPO:
				return true
			if not pode_agir() or recargas.get("rolar", 0.0) > 0.0 or not mov.chao:
				return false
			if not trabalho.gastar(float(trabalho.E.rolar)):
				return true
			recargas["rolar"] = D.HEROI.rolar_cd
			rede("rolar")
			var dir := direcao_joystick()
			if dir.length() > 0.1:
				mov.ry = atan2(dir.x, dir.z)
				mov.ry_mira = null
				heroi.rotation.y = mov.ry
			comecar("rolar", 1.15, [], func(_i): pass, {"anda": 6.0})
			sons.tocar("pano", -4.0)
			sons.tocar("dash", -10.0, 0.1, null, 0.8)
		"menu":
			menu.abrir()
		"falar": # perto de um NPC: abre a janela dele (conversa.gd)
			conversa.tocar_botao()
		"selo": # na porta da Caverna da Montanha: gasta um passe e o selo abre (caverna.gd; o servidor confere)
			caverna.usar_passe()
		"coletar": # veio ou árvore perto: minera ou corta lenha (trabalho.gd)
			trabalho.tocar_botao()
		"bancada": # perto de uma estação do lote (construcao.gd): bancada = Alfaiate; bigorna ou fornalha = Ferreiro
			# André 2026-11-05: um menu só, a aba Criar inteira. 2026-11-07: longe (ou do outro lado da parede) o herói
			# vai andando até a estação, entrando pela porta, e abre quando chega (construcao.gd tocar_estacao)
			construcao.tocar_estacao("bancada")
		"construir": # no meu lote: abre ou fecha o modo construção (construcao.gd)
			construcao.tocar_botao_construir()
		"lote": # perto da placa de um lote à venda: pergunta se quer comprar
			construcao.perguntar_compra()
		"bau": # perto do meu baú (construcao.gd): abre o baú
			construcao.tocar_estacao("bau") # 2026-11-07: longe ou do lado de fora da parede, anda até ele e abre
		"encher": # perto do poço da vila ou na beira do lago (André 2026-11-07): enche o regador
			construcao.encher_regador()
		"cama": # à noite, perto da minha cama (construcao.gd, dia e noite do Quimera 2026-11-07): anda até ela e dorme
			construcao.tocar_estacao("cama")
		"forno": # a minha fornalha (construcao.gd, 2026-11-07): anda até o lado dela e abre a janela de combustível + material
			construcao.tocar_estacao("forno")
		"correio": # perto da minha caixa de correio (construcao.gd): a conta semanal do terreno
			construcao.abrir_correio()
		"estacoes": # no terreno/casa (André 2026-11-07): recolhe ou expande os botões das estações (construcao.gd)
			construcao.alternar_estacoes()
		_:
			if qual.begins_with("hab"):
				return habilidade(int(qual.substr(3)))
	return true

# ---------- skills do Quimera (progresso.gd / shared/progresso.js; cada tipo = uma função do Quimera) ----------
# a barra da arma na mão (Trocar mostra a outra)
func barra_atual() -> Array:
	return P.prog.barras[P.barra_de(h.modo)]

func vivo(e) -> bool:
	return e is Dictionary and e.estado != "morto"

func virar_para(e) -> void:
	if vivo(e):
		var d: Vector3 = e.no.position - heroi.position
		mov.mirar(atan2(d.x, d.z)) # vira em ~0,1 s (antes estalava na hora)

# toca a animação durando dur segundos; hits em segundos (como as skills do Quimera)
func comecar_q(nome: String, dur: float, hits: Array, ao_acertar: Callable, extra := {}) -> void:
	var fr := []
	for t in hits:
		fr.append(float(t) / dur)
	comecar(nome, heroi_anim.get_animation(nome).length / dur, fr, ao_acertar, extra)

func sem_alvo() -> void:
	if tempo - h.sem_alvo > 1.2:
		h.sem_alvo = tempo
		hud.aviso("Longe demais" if mais_perto(heroi.position, 40.0) else "Nenhum inimigo por perto")

# Golpe básico da arma na mão. Não trava: dá para andar enquanto bate (como no Quimera)
func basico() -> bool:
	if acao.get("basico", false) and acao.t >= acao.fim: # o golpe anterior já acabou (só segura a pose): emenda
		acao = {}
	if h.morto > 0.0 or mov.esc != null or not acao.is_empty() or recargas.get("basico", 0.0) > 0.0:
		return false
	h.ultimo_basico = tempo
	if h.modo == "Espada":
		basico_espada()
	else:
		basico_magia()
	return true

# Espada: combo de 4 cortes (0,48 s cada, volta ao 1º depois de 0,8 s sem bater). Alvo longe (até 12 m): corre até ele
func basico_espada() -> void:
	var hab: Dictionary = P.hab_pronta("espada_basico")
	var alvo = mais_perto(heroi.position, hab.alcance)
	if alvo == null:
		var longe = mais_perto(heroi.position, hab.persegue)
		if longe:
			h.pend = {"e": longe, "t": 3.0}
			recargas["basico"] = 0.15
		else:
			sem_alvo()
			recargas["basico"] = 0.25
		return
	h.pend = null
	virar_para(alvo)
	var i: int = 0 if tempo - h.combo_fim > hab.comboZera else (h.combo + 1) % hab.combo.size()
	passo_golpe(alvo, i == hab.combo.size() - 1)
	h.combo = i
	if expressao:
		expressao.golpeou()
	var g: Dictionary = hab.combo[i]
	var fade: float = 0.14 if i == 0 else 0.05 # 4º -> 1º golpe: a pose muda muito, mistura mais devagar
	h.combo_fim = tempo + g.dur
	recargas["basico"] = max(hab.cd, g.dur) # o 4º golpe é mais longo: o próximo espera ele terminar
	rede("habQ", "espada_basico")
	var ultimo: bool = i == hab.combo.size() - 1
	comecar_q(g.anim, g.dur, [g.hit], func(_k):
		h.golpe_forte = ultimo # o último corte do combo pesa mais (congela e treme mais)
		var acertou := dano_arco(hab.alcance, hab.arco, hab.dmg, hab)
		if acertou.is_empty() and vivo(alvo) and alvo.no.position.distance_to(heroi.position) < 3.6:
			ferir(alvo, hab.dmg, heroi.position, hab)
			if on():
				acertou.append(alvo.no.position)
		h.golpe_forte = false
		if not acertou.is_empty() and on(): # online o dano vem do servidor, mas a sensação do corte é na hora
			impacto_golpe(acertou[0], ultimo, false, true)
		acertou.clear(), {"cancela": true, "lamina": true, "alvo": alvo, "basico": true, "fade": fade})
	# André 2026-11-06: andando de lado e batendo, o corpo ficava indo e voltando entre o joystick e o alvo (tremia).
	# Entre um corte e outro ele continua virado para o alvo e anda de lado, como o mago.
	h.mira_espada = alvo
	h.mira_ate = tempo + g.dur + 0.6
	# vento da lâmina um pouco antes do corte
	var vento_t: float = max(0.0, g.hit - 0.12)
	fx.agenda.append({"t": vento_t, "fn": func(): sons.tocar("golpe", -3.0 if ultimo else -5.0, 0.08, null, 0.85 if ultimo else 1.0)})
	segurar_pose(0.35)

# Alvo travado do mago (André 2026-11-03): o 1º ataque pega o monstro mais perto e daí em diante o alvo
# só troca quando ele toca em outro monstro ou quando o alvo morre (aí volta a pegar o mais perto).
# Antes cada faísca escolhia de novo o mais perto e o alvo pulava sozinho. Devolve o monstro, ou false se o
# travado está vivo mas fora do alcance (continua travado), ou null se não tem ninguém.
const ALVO_SOLTA := 25.0 # travado mais longe que isso (fugiu, voltou para a clareira dele) solta
func alvo_travado(alcance: float):
	if not vivo(h.alvo_fixo):
		h.alvo_fixo = null
	if h.alvo_fixo != null:
		var d: float = h.alvo_fixo.no.position.distance_to(heroi.position)
		if d <= alcance:
			return h.alvo_fixo
		if d <= ALVO_SOLTA:
			return false
		h.alvo_fixo = null
	var e = mais_perto(heroi.position, alcance)
	if e != null:
		h.alvo_fixo = e
	return e

# toque rápido na tela em cima de um monstro: ele vira o alvo travado (o mais perto do dedo na tela)
func tocou_inimigo(pos: Vector2) -> void:
	if camera == null or h.morto > 0.0 or menu.aberto():
		return
	var achou = null
	var md := 1e9
	for e in inimigos:
		if not vivo(e) or e.get("longe", false) or not e.no.visible:
			continue
		var pe: Vector3 = e.no.position
		if pe.distance_to(heroi.position) > ALVO_SOLTA:
			continue
		var cabeca: Vector3 = pe + Vector3.UP * 1.6 * max(0.5, e.no.scale.y)
		if camera.is_position_behind(pe) or camera.is_position_behind(cabeca):
			continue
		var a: Vector2 = camera.unproject_position(pe)
		var b: Vector2 = camera.unproject_position(cabeca)
		var largura: float = max(40.0, (a.y - b.y) * 0.45) # dedo é grosso: folga para os lados
		if pos.y < b.y - 24.0 or pos.y > a.y + 24.0 or abs(pos.x - lerp(a.x, b.x, 0.5)) > largura:
			continue
		var dt: float = pos.distance_to(a.lerp(b, 0.5))
		if dt < md:
			md = dt
			achou = e
	if achou != null:
		h.alvo_fixo = achou

# índice do monstro (o "v" do servidor) para o servidor mirar no mesmo alvo travado
func indice_inimigo(e) -> int:
	return inimigos.find(e) if vivo(e) else -1

# Cajado: faísca de fogo que mira sozinha no alvo travado (alvo_travado; 9 m), alternando as mãos
func basico_magia() -> void:
	var hab: Dictionary = P.hab_pronta("cajado_basico")
	var alvo = alvo_travado(hab.alcance + 0.5)
	if alvo is bool:
		if tempo - h.sem_alvo > 1.2:
			h.sem_alvo = tempo
			hud.aviso("Alvo longe demais")
		recargas["basico"] = 0.25
		return
	if alvo == null:
		sem_alvo()
		recargas["basico"] = 0.25
		return
	virar_para(alvo)
	h.mao = 1 - h.mao
	var g: Dictionary = hab.combo[h.mao]
	recargas["basico"] = hab.cd
	rede("habQ", {"id": "cajado_basico", "v": indice_inimigo(alvo)})
	comecar_q(g.anim, g.dur, [g.hit], func(_k): atirar(hab, alvo, hab.alcance + 3.0), {"livre": true, "alvo": alvo, "basico": true})
	heroi_anim.so_tronco = true # andando, as pernas continuam no passo e só os braços atiram
	h.mira_ate = tempo + g.dur + 0.6 # entre um tiro e outro continua virado para o alvo (não fica virando para lá e para cá)
	segurar_pose(0.35)

# Mago atirando a Faísca: o alvo para onde o corpo fica virado (o tiro de agora ou logo depois do último).
# null = anda normal, virando para onde o joystick aponta.
func mira_mago():
	if montaria != null or mov.esc != null:
		return null
	if h.modo == "Espada":
		return mira_espada()
	if h.modo != "Magia":
		return null
	if not acao.is_empty() and acao.get("basico", false) and acao.has("alvo"):
		if vivo(acao.alvo):
			return acao.alvo
		# o alvo morreu no meio do tiro (André 2026-11-04): vira para o mais perto; sem ninguém, cancela a Faísca
		# (antes o último tiro saía no ar, para onde ele corria)
		var novo = novo_alvo_mago()
		if novo != null:
			acao.alvo = novo
			return novo
		if h.modo == "Magia":
			acao = {}
		return null
	if acao.is_empty() and tempo < float(h.mira_ate):
		if vivo(h.alvo_fixo):
			return h.alvo_fixo
		return novo_alvo_mago() # entre um tiro e outro o bicho morreu: já gira para o próximo
	return null

# Espada: virado para o bicho do último corte enquanto ainda está batendo (botão segurado ou golpe logo depois).
# Golpe plantando o pé (não cancelado) já vira sozinho; aqui é o pedaço em que o joystick cortou o resto do golpe.
func mira_espada():
	if not acao.is_empty() or tempo >= float(h.mira_ate) or not vivo(h.mira_espada):
		return null
	var hab: Dictionary = P.hab_pronta("espada_basico")
	if h.mira_espada.no.position.distance_to(heroi.position) > float(hab.alcance) + 3.0:
		return null # foi embora: volta a andar virado para o joystick
	return h.mira_espada

# o próximo alvo do mago quando o travado morre: o mais perto no alcance da Faísca (vira o novo travado)
func novo_alvo_mago():
	var hab: Dictionary = P.hab_pronta("cajado_basico")
	var e = alvo_travado(hab.alcance + 0.5)
	return e if e is Dictionary else null

# o golpe básico fica parado no último quadro mais um pouco: o próximo golpe do combo emenda direto,
# sem voltar para a corrida no meio (era o "pulo" que aparecia no loop do combo)
func segurar_pose(extra: float) -> void:
	var hit_s: float = acao.hits[0] * acao.dur
	acao.fim = acao.dur
	acao.dur += extra
	acao.hits = [hit_s / acao.dur]

func atirar(hab: Dictionary, alvo, alcance: float) -> void:
	var info: Dictionary = hab.proj.duplicate()
	info.cor = Color(info.cor)
	info.hab = hab
	var de := ponto_mao()
	if hab.get("basico", false) and h.mao == 1: # Faísca: a 2ª do combo sai da mão esquerda
		de = ponto_mao_esq()
	elif hab.tipo == "bola": # Bola de Fogo: sai do meio das duas mãos
		de = (ponto_mao() + ponto_mao_esq()) * 0.5
	var dir := frente()
	if hab.get("basico", false) and not vivo(alvo):
		# Faísca com o alvo morto: vai no novo alvo (mira_mago já virou o corpo); sem ninguém, não sai no ar
		alvo = acao.get("alvo") if vivo(acao.get("alvo")) else novo_alvo_mago()
		if alvo == null:
			return
	if vivo(alvo):
		dir = ((alvo.no.position + Vector3(0, 1.0, 0)) - de).normalized()
	fx.projetil(de, dir, info, hab.dmg, alcance)

# o alvo que a skill precisa (igual a Simulacao.alvoHab): sem ninguém no alcance ela nem sai. false = não pode
func alvo_hab(hab: Dictionary):
	var t: String = hab.tipo
	if t == "corte" or t == "esmagar":
		return mais_perto(heroi.position, hab.lunge.r)
	if t in ["bola", "cadeia", "meteoro"] and vivo(h.alvo_fixo) and h.alvo_fixo.no.position.distance_to(heroi.position) <= hab.alcance + 0.5:
		return h.alvo_fixo # magia de alvo único vai no alvo travado do mago quando ele está no alcance
	if t in ["bola", "cadeia", "meteoro", "investida"]:
		var e = mais_perto(heroi.position, hab.alcance + 0.5)
		return e if e else false
	if t in ["anel", "gelo", "puxar"]:
		var e = mais_perto(heroi.position, hab.area)
		return e if e else false
	return null

# Botão i da barra da arma na mão
func habilidade(i: int) -> bool:
	var k = barra_atual()[i]
	if k == null or not P.habs.has(k):
		hud.aviso("Escolha uma skill no menu do personagem")
		return true
	if not P.liberada(k):
		hud.aviso("Libera no nível %d" % int(P.habs[k].libera))
		return true
	if recargas.get(k, 0.0) > FILA_TEMPO:
		return true
	if h.morto > 0.0 or mov.esc != null or not mov.chao or not acao.is_empty() or recargas.get(k, 0.0) > 0.0:
		return false # como no Quimera: não corta uma skill no meio (fica na fila e sai quando a outra acabar)
	var hab: Dictionary = P.hab_pronta(k)
	if h.mana < hab.get("mana", 0):
		hud.aviso("Mana insuficiente")
		hud.negar("hab%d" % i)
		return true
	var alvo = alvo_hab(hab)
	if alvo is bool:
		sem_alvo()
		return true
	h.pend = null
	h.mana -= hab.get("mana", 0)
	virar_para(alvo)
	var dir := direcao_joystick()
	if hab.tipo == "teleporte":
		rede("habQ", {"id": k, "dx": snappedf(dir.x, 0.01), "dz": snappedf(dir.z, 0.01)})
	elif hab.tipo in ["bola", "cadeia", "meteoro"] and vivo(alvo):
		rede("habQ", {"id": k, "v": indice_inimigo(alvo)}) # o servidor mira no mesmo alvo
	else:
		rede("habQ", k)
	if hab.has("canal"): # magia concentrada: andar (joystick forte), pular ou dar dash cancela e devolve 70% da mana
		var dur: float = hab.canal / hab.at
		fx.conjura(heroi, P.FX.get(k, "magia"), dur, maos2 if hab.tipo in ["bola", "gelo", "meteoro"] else maos)
		if hab.tipo == "meteoro" and vivo(alvo): # portal no céu em cima do alvo enquanto concentra
			fx.meteoro_portal(alvo.no.position.x, alvo.no.position.z, chao_em(alvo.no.position.x, alvo.no.position.z), dur + float(hab.queda))
		if hab.has("area"): # aviso no chão de onde a magia vai pegar enquanto concentra (Meteoro: em cima do alvo)
			combate.aviso_area(alvo.no if hab.tipo == "meteoro" and vivo(alvo) else heroi, float(hab.area), dur, Color(fx.cor_de(P.FX.get(k, "magia"))[1]))
		comecar_q(hab.anim, dur, [hab.canal], func(_n):
			acao.canal = false
			acao.cancela = true
			recargas[k] = hab.cd
			contar_offline(k)
			soltar(k, hab, alvo if vivo(alvo) else alvo_hab(hab), dir), {"canal": true, "hab": k, "mana": hab.get("mana", 0)})
		return true
	recargas[k] = hab.cd
	contar_offline(k)
	soltar(k, hab, alvo, dir)
	return true

func contar_offline(k: String) -> void:
	if not on():
		var subiu: String = P.contar_uso(k)
		if subiu != "":
			hud.aviso(subiu)

func cancelar_canal(motivo := "Cancelado") -> void:
	if not acao.get("canal", false):
		return
	h.mana = min(P.st.manaMax, h.mana + acao.mana * 0.7)
	acao = {}
	fx.status_fim(heroi)
	fx.cancelar_conjura(heroi)
	combate.aviso_area_fim()
	rede("cancelar")
	hud.aviso(motivo)
	heroi_anim.play("parada" if h.modo == "Magia" else "espada_parada", 0.15)

# cada corte do básico dá meio passo para o alvo (o 4º, um passo inteiro), sem encostar nele
func passo_golpe(alvo, forte: bool) -> void:
	if not vivo(alvo) or h.lunge != null:
		return
	var d: Vector3 = alvo.no.position - heroi.position
	d.y = 0
	var falta: float = d.length() - 1.25
	if falta <= 0.05:
		return
	var t := 0.12
	h.lunge = {"v": d.normalized() * min(falta, 0.8 if forte else 0.4) / t, "t": t, "fantasma": false}

# passo rápido até o inimigo (lunge do Quimera, antes do Corte Duplo e do Golpe Esmagador)
func lunge(alvo, para: float) -> void:
	if not vivo(alvo):
		return
	var d: float = Vector2(alvo.no.position.x - heroi.position.x, alvo.no.position.z - heroi.position.z).length() - para
	if d > 0.3:
		var t: float = min(0.25, 0.05 + d * 0.04)
		h.lunge = {"v": frente() * d / t, "t": t, "fantasma": false}

func soltar(k: String, hab: Dictionary, alvo, dir: Vector3) -> void:
	var p0 := heroi.position
	var fxk: String = P.FX.get(k, "magia")
	match hab.tipo:
		"corte", "esmagar":
			lunge(alvo, hab.lunge.para)
			fx.conjura(heroi, fxk, hab.dur, maos)
			comecar_q(hab.anim, hab.dur, hab.hits, func(_n):
				var p: Vector3 = heroi.position + frente() * hab.ponto
				dano_area(p, hab.area, hab.dmg, hab)
				fx.explosao_hab(fxk, p.x, p.z, hab.area, heroi.position.y), {"cancela": true, "lamina": true})
		"giro", "pisao":
			fx.conjura(heroi, fxk, hab.dur, maos)
			comecar_q(hab.anim, hab.dur, hab.hits, func(_n):
				dano_area(heroi.position, hab.area, hab.dmg, hab)
				fx.explosao_hab(fxk, heroi.position.x, heroi.position.z, hab.area, heroi.position.y), {"cancela": true, "lamina": true})
		"investida": # dash atravessando os inimigos em linha
			var L: float = min(hab.alcance, alvo.no.position.distance_to(p0) + 2.5)
			var f := frente()
			h.lunge = {"v": f * L / hab.dashT, "t": hab.dashT, "fantasma": true}
			fx.dash(heroi, hab.dashT + 0.12, true)
			comecar_q(hab.anim, hab.dur, hab.hits, func(_n):
				var linha := []
				for e in inimigos:
					if e.estado == "morto":
						continue
					var d: Vector3 = e.no.position - p0
					var a: float = d.x * f.x + d.z * f.z
					var lado: float = abs(d.x * f.z - d.z * f.x)
					if a > -0.5 and a < L + 1.0 and lado < hab.largura:
						linha.append([a, e])
				linha.sort_custom(func(x, y): return x[0] < y[0])
				for i in min(linha.size(), int(round(hab.alvos))):
					var e = linha[i][1]
					ferir(e, hab.dmg * pow(hab.cai, i), p0, hab)
					fx.impacto(e.no.position.x, e.no.position.z, heroi.rotation.y, fxk, e.no.position.y), {"lamina": true})
		"bola":
			atirar(hab, alvo, hab.alcance + 6.0)
		"anel":
			mov.vy = 3.2 # pulinho
			mov.chao = false
			dano_area(p0, hab.area, hab.dmg, hab)
			fx.explosao_hab(fxk, p0.x, p0.z, hab.area, p0.y)
		"gelo":
			dano_area(p0, hab.area, hab.dmg, hab)
			fx.explosao_hab(fxk, p0.x, p0.z, hab.area, p0.y)
		"meteoro":
			var c: Vector3 = alvo.no.position if vivo(alvo) else p0 + frente() * 5.0
			fx.meteoro(c.x, c.z, hab.area, hab.queda, chao_em(c.x, c.z), func(_p): dano_area(c, hab.area, hab.dmg, hab))
		"cadeia": # da mão no alvo, depois pula para o mais perto dele (5,5 m)
			var feitos := []
			var de := ponto_mao()
			var e = alvo
			for i in int(round(hab.alvos)):
				if not vivo(e):
					break
				feitos.append(e)
				var n: float = hab.dmg * pow(hab.cai, i)
				var a: Vector3 = de
				var alvo_i = e
				fx.agenda.append({"t": i * 0.08, "fn": func():
					if vivo(alvo_i):
						fx.cadeia(a, alvo_i.no.position + Vector3(0, 1.0, 0))
						ferir(alvo_i, n, a, hab)})
				de = e.no.position + Vector3(0, 1.0, 0)
				var prox = null
				var md: float = hab.pula
				for q in inimigos:
					var dq: float = q.no.position.distance_to(e.no.position)
					if q.estado != "morto" and not feitos.has(q) and dq < md:
						md = dq
						prox = q
				e = prox
		"teleporte":
			teleportar(hab, dir)
		"cura":
			var n: float = min(round(P.st.vidaMax * hab.curaPct), P.st.vidaMax - h.vida)
			h.vida += n
			fx.cura(heroi)
			fx.numero(heroi.position, n, Color("7dffa0"))
			fx.anel(p0.x, p0.z, hab.grupo, "9be08f", 0.9, p0.y)
		"escudo":
			comecar_q(hab.anim, hab.dur, [], func(_n): pass, {"cancela": true})
			h.escudo = float(hab.absorve)
			h.escudo_ate = tempo + float(hab.duracao)
			fx.escudo(heroi, float(hab.duracao))
		"puxar": # puxa para perto (não puxa chefe) e segura um instante; não tira vida
			fx.vortice(p0.x, p0.z, hab.area, p0.y)
			for e in inimigos:
				if e.estado == "morto" or e.tipo in CHEFES:
					continue
				var d: Vector3 = p0 - e.no.position
				d.y = 0
				if d.length() < hab.area:
					e.puxao = d.normalized() * max(0.0, d.length() - 1.6) / 0.3
					e.puxao_t = 0.3
					e.parado = max(e.parado, tempo + hab.atordoa)

# Salto Arcano: some e aparece até 5,5 m (+0,6 por nível) para onde o joystick aponta, parando antes da parede
func teleportar(hab: Dictionary, dir: Vector3) -> void:
	var f := Vector3(dir.x, 0, dir.z).normalized() if dir.length() > 0.15 else frente()
	mov.ry = atan2(f.x, f.z)
	heroi.rotation.y = mov.ry
	var de := heroi.position
	var outros_antes: Array = mov.outros.duplicate()
	mov.outros.clear() # passa por cima de quem estiver no caminho
	for i in int(round(hab.distancia / 0.25)):
		var x0: float = mov.x
		var z0: float = mov.z
		var y0: float = mov.y
		mov.bloqueado = false
		mov.mover(f.x * 0.25, f.z * 0.25)
		if mov.bloqueado or Vector2(mov.x - x0, mov.z - z0).length() < 0.2:
			mov.x = x0
			mov.z = z0
			mov.y = y0
			break
	mov.outros = outros_antes
	heroi.position = mov.posicao()
	fx.teleporte(de, heroi.position)
	heroi.visible = false
	fx.agenda.append({"t": 0.1, "fn": func(): heroi.visible = true})

func maos() -> Array:
	return [ponto_mao()]

func maos2() -> Array:
	return [ponto_mao(), ponto_mao_esq()]

# botões da tela: a barra da arma na mão (skill ainda não liberada aparece apagada)
func mostrar_build() -> void:
	var icones := []
	var travados := []
	for k in barra_atual():
		icones.append(P.ICONE.get(k, "") if k != null else "")
		travados.append(k != null and not P.liberada(k))
	hud.mostrar_build(icones, h.modo, travados)
	# borda de cada botão na cor do elemento da skill
	var barra: Array = barra_atual()
	for i in barra.size():
		var k = barra[i]
		hud.borda("hab%d" % i, Color(fx.cor_de(P.FX.get(k, "magia"))[1]).lightened(0.15) if k != null and P.habs.has(k) else null)

# velocidade da animação de andar/correr para o passo bater com o chão (andar.gd: PASSO_*)
func ritmo(a: String) -> float:
	if a == "corrida":
		return mov.CORRIDA / mov.PASSO_CORRIDA
	if a == "andar":
		return mov.ANDAR / mov.PASSO_ANDAR
	return 1.0

func direcao_joystick() -> Vector3:
	var m: Vector2 = hud.mover
	if construcao and construcao.camera_livre(): # modo construção / compra de terreno: o joystick move a mira, o herói fica
		return Vector3.ZERO
	if m.length() < 0.15:
		if conversa and conversa.indo != null: # tocou num NPC longe: vai até ele
			return conversa.direcao_auto()
		if rota and rota.ativo: # "Ir para" do mapa: vai pela estrada
			return rota.direcao_auto()
		if construcao and construcao.plano and construcao.plano.andando(): # plano da fazenda: vai até o próximo canteiro
			return construcao.plano.direcao_auto()
		return trabalho.direcao_auto() if trabalho else Vector3.ZERO
	return Vector3(m.x, 0, m.y).rotated(Vector3.UP, cam.yaw)

# ---------- quadro a quadro ----------
# app indo para o fundo ou fechando: grava na hora a cópia do progresso que estava esperando
func _notification(what: int) -> void:
	if (what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_PREDELETE) and P != null:
		P.guardar_agora()
		if volta:
			volta.guardar(true)

func _process(dt: float) -> void:
	var t0_main := Time.get_ticks_usec()
	_passo_main(dt)
	ms_main = lerp(ms_main, (Time.get_ticks_usec() - t0_main) / 1000.0, 0.05)

func _passo_main(dt: float) -> void:
	if not _a_criar.is_empty():
		criar_aos_poucos()
	LodMalha.passo() # LOD das malhas montadas no jogo, aos poucos e na linha de fundo
	# congelada do golpe: dt já vem quase zero; a câmera e a HUD usam o tempo de verdade
	var dt_real: float = dt / max(Engine.time_scale, 0.001)
	var agora_s: float = Time.get_ticks_usec() / 1000000.0
	if Engine.time_scale < 1.0 and agora_s >= _hitstop_ate:
		Engine.time_scale = _lenta_k if agora_s < _lenta_ate else 1.0
	tempo += dt
	P.passo(dt_real) # grava a cópia do progresso fora do quadro (progresso.gd)
	volta.passo(dt) # Voltar para a vila (canalização) e o lugar guardado no aparelho
	for k in recargas.keys():
		recargas[k] = max(0.0, recargas[k] - dt)
	atualizar_heroi(dt)
	lod_inimigos()
	if not on():
		atualizar_inimigos(dt)
	barras_perto()
	avisar_zona()
	# andando ou correndo de espada na mão (sem golpe nem parede): braço direito segura a lâmina baixa e para trás
	var andando: bool = heroi_anim.current_animation in ["andar", "corrida"] and mov.velocidade() > 0.3
	var quer: float = 1.0 if h.modo == "Espada" and acao.is_empty() and mov.esc == null and andando and h.morto <= 0.0 and not _nadando else 0.0 # nadando os braços são da braçada
	braco.peso = move_toward(braco.peso, quer, dt * 6.0)
	vestir_heroi()
	Armadura.vento(heroi, mov.velocidade() if h.morto <= 0.0 else 0.0, dt)
	_flash_passo(dt_real)
	combate.passo(dt_real)
	# marca no chão de quem o golpe vai pegar (o mais perto, até 12 m; de cajado, o alvo travado)
	if h.alvo_fixo != null and (not vivo(h.alvo_fixo) or h.alvo_fixo.no.position.distance_to(heroi.position) > ALVO_SOLTA):
		h.alvo_fixo = null # morreu (ou fugiu longe): o próximo ataque pega o mais perto
	var marcado = mais_perto(heroi.position, 12.0) if h.morto <= 0.0 else null
	if h.modo == "Magia" and h.alvo_fixo != null and h.morto <= 0.0:
		marcado = h.alvo_fixo
	combate.marcar(marcado.no if marcado else null, dt_real)
	# câmera em volta do herói (arrastar o dedo do lado direito gira): camera_heroi.gd
	var g: Vector2 = hud.giro_cam
	hud.giro_cam = Vector2.ZERO
	cam.zoom(hud.zoom_cam) # dois dedos (pinça) ou roda do mouse
	hud.zoom_cam = 1.0
	cam.atualizar(min(dt_real, 0.1), g)
	if cinematica and cinematica.ativa:
		cinematica.camera(min(dt_real, 0.1)) # a câmera da cena manda por cima da do jogo
	folhagem_na_frente(dt_real)
	# HUD
	hud.vida = h.vida / P.st.vidaMax
	hud.mana = h.mana / P.st.manaMax
	hud.estamina = trabalho.sta / max(1.0, trabalho.sta_max())
	hud.sem_folego = trabalho.sem_folego
	hud.vigor = P.vigor() / max(1.0, float(P.dados.vigor.max))
	hud.texto_vida = "%d/%d" % [ceil(h.vida), P.st.vidaMax]
	hud.texto_mana = "%d/%d" % [floor(h.mana), P.st.manaMax]
	hud.nivel = P.prog.nivel
	colorir_niveis()
	hud.xp = float(P.prog.xp) / max(1, P.xp_prox)
	hud.escudo = h.escudo > 0.0 and h.escudo_ate > tempo
	# em combate (bateu ou apanhou nos últimos segundos): símbolo no painel e música de combate
	hud.em_combate = trabalho.em_combate()
	# André 2026-11-06: "Eye of the Storm" para chefe e masmorra; "Battle for the Kingdom" para os monstros em geral
	# André 2026-11-07: a música não corta enquanto um monstro perto ainda está na luta (preparando golpe, perseguindo)
	var luta_musica: bool = hud.em_combate or (musica.lutando and luta_perto()) # só segura a luta que já começou
	musica.combate(luta_musica, dt_real, luta_musica and (luta_com_chefe() or na_masmorra()))
	# FPS (auditoria 2026-11-11): recargas a cada 2 quadros; poções e o botão Falar a cada 6 (mudam devagar)
	var q_hud := Engine.get_process_frames()
	var barra: Array = barra_atual() if q_hud % 2 == 0 else []
	for i in barra.size():
		var k = barra[i]
		hud.recarga("hab%d" % i, recargas.get(k, 0.0) if k != null else 0.0, P.hab_nivel(k).cd * (1 - P.st.recarga) if k != null else 1.0)
		hud.sem_mana("hab%d" % i, k != null and P.habs.has(k) and h.mana < float(P.habs[k].get("mana", 0)))
	hud.canal = acao.t / (acao.dur * acao.hits[0]) if acao.get("canal", false) else volta.progresso()
	hud.canal_vila = volta.ativo()
	if volta.ativo():
		hud.canal_vila_txt = volta.texto()
	if q_hud % 6 == 0:
		hud.mostrar_botao("falar", conversa != null and conversa.npc_perto() != null and h.morto <= 0.0)
	# lobo: o botão só aparece depois da missão que amansa o lobo (André 2026-11-11: "tira o botão de montaria enquanto
	# não tiver liberado"). Montado continua aparecendo, para poder descer.
	hud.mostrar_botao("montar", montaria != null or nevoa == null or nevoa.liberado("lobo", true)) # estrito: queda de conexão não abre
	if P.mudou:
		P.mudou = false
		mostrar_build()
		if menu:
			menu.atualizar()
	hud.recarga("cura", recargas.get("cura", 0.0), D.CURA.cd)
	for k in ["pocao", "pocao_mana"]:
		hud.recarga(k, recargas.get("it:" + k, 0.0), recarga_pocao())
		if q_hud % 6 == 0:
			hud.contagem(k, P.contar(k))
	hud.recarga("dash", recargas.get("dash", 0.0), D.MOVIMENTO.dash_cd)
	hud.recarga("rolar", recargas.get("rolar", 0.0), D.HEROI.rolar_cd)
	atualizar_teste(dt)

func atualizar_heroi(dt: float) -> void:
	if cinematica and cinematica.ativa and h.morto <= 0.0: # cena da história: o herói fica parado (cinematica.gd)
		cinematica.heroi(dt)
		return
	if h.morto > 0.0:
		corpo_caido(dt)
		if on():
			return # online: o servidor levanta o herói
		h.morto -= dt
		if h.morto <= 0.0:
			h.vida = P.st.vidaMax
			h.mana = P.st.manaMax
			mov.por_em(totem.onde_renascer(D.NASCIMENTO) if totem else D.NASCIMENTO) # último totem tocado (André 2026-11-10)
			heroi.position = mov.posicao()
			cam.colocar(heroi.position)
			heroi_anim.play("parada", 0.2)
			hud.aviso("Você se levanta de novo" + _penalidade_txt)
			_penalidade_txt = ""
		return
	var luta: bool = trabalho.em_combate() # Quimera: em luta a mana volta a 35% e a vida não volta
	var R: Dictionary = P.regen()
	h.mana = min(P.st.manaMax, h.mana + P.st.regenMana * (float(R.manaCombate) if luta else 1.0) * dt)
	if not on():
		h.vida = min(P.st.vidaMax, h.vida + P.st.regenVida * (float(R.vidaCombate) if luta else 1.0) * (totem.regen_k(heroi.position) if totem else 1.0) * dt)
	if h.escudo_ate <= tempo:
		h.escudo = 0.0
	# repete o ataque básico só enquanto o dedo está no botão; soltou, para na hora (sem deixar o herói farmando sozinho)
	if h.segurando and not hud.segurando("basico"):
		h.segurando = false
	if h.segurando and tempo - h.ultimo_basico > 0.2:
		basico()
	# botão guardado na fila: sai assim que der
	if fila != null:
		if tempo > fila.ate:
			fila = null
		elif _tentar(fila.q):
			fila = null
	var dir := direcao_joystick()
	var forca: float = 0.0 if construcao and construcao.camera_livre() else hud.mover.length()
	# espada: tocou o golpe com o alvo longe, corre até ele e bate quando chega (o joystick cancela)
	if h.pend != null:
		var pe: Dictionary = h.pend
		pe.t -= dt
		var e = pe.e
		if forca > 0.15 or pe.t <= 0.0 or not vivo(e) or h.modo != "Espada":
			h.pend = null
		else:
			var d: Vector3 = e.no.position - heroi.position
			d.y = 0
			if d.length() < 2.9 + 0.25:
				h.pend = null
				recargas["basico"] = 0.0
				basico()
			else:
				dir = d.normalized()
				forca = 1.0
	# voltando para a vila: parado; mexer o joystick cancela
	if volta.ativo():
		if forca > 0.3:
			volta.cancelar("Você se mexeu: volta para a vila cancelada")
		else:
			dir = Vector3.ZERO
			forca = 0.0
	# magia concentrada: o herói fica parado; puxar o joystick com força cancela
	if acao.get("canal", false):
		if forca > 0.55:
			cancelar_canal()
		else:
			dir = Vector3.ZERO
			forca = 0.0
	mov.outros.clear()
	var fantasma: bool = h.lunge != null and h.lunge.fantasma
	if not fantasma:
		# só quem está a menos de 20 m (o empurrão é a 0,7 m): antes iam os ~400 monstros do mapa, e andar.gd confere
		# cada um em todo passo do movimento
		for e in inimigos_perto:
			if e.estado != "morto" and e.no.position.distance_squared_to(heroi.position) < 400.0:
				mov.outros.append(e.no.position)
		for n in npcs:
			mov.outros.append(n.no.position)
	if h.lunge != null: # passo rápido até o alvo (lunge) ou o dash da Investida
		var lg: Dictionary = h.lunge
		var passo: float = min(dt, lg.t)
		mov.mover(lg.v.x * passo, lg.v.z * passo)
		lg.t -= dt
		if lg.t <= 0.0:
			h.lunge = null
	# ação em andamento: golpes acertam no tempo certo da animação; avanço e rolamento andam pelo terreno
	if not acao.is_empty():
		acao.t += dt
		var frac: float = acao.t / acao.dur
		while acao.feitos < acao.hits.size() and frac >= acao.hits[acao.feitos]:
			acao.fn.call(acao.feitos)
			if acao.is_empty():
				break
			acao.feitos += 1
		if not acao.is_empty():
			var f := frente()
			if acao.has("avanco") and acao.t < acao.dur * acao.avanco_t:
				var v: float = acao.avanco / (acao.dur * acao.avanco_t) * dt
				mov.mover(f.x * v, f.z * v)
			if acao.has("anda"):
				var v2: float = acao.anda * (1.0 - frac) * dt * 1.4
				mov.mover(f.x * v2, f.z * v2)
			if acao.t >= acao.dur:
				acao = {}
	var estava_escalando: bool = mov.esc != null
	var estava_no_chao: bool = mov.chao
	# golpe e skill de espada não travam: anda enquanto bate, virado para o alvo
	# golpe de espada e skills plantam o pé; depois que o golpe acerta, mexer o joystick corta o resto e o herói anda
	# (como nos RPGs de referência: dá para girar em volta do alvo entre um golpe e outro)
	if not acao.is_empty() and acao.get("cancela", false) and forca > 0.15 and acao.feitos >= acao.hits.size():
		acao = {}
	var livre: bool = acao.is_empty() or acao.get("pulo", false) or acao.get("livre", false)
	# o tiro básico do cajado anda junto, mais devagar (P.dados.andarAtirando), mudando aos poucos (sem tranco)
	var k_alvo: float = float(P.dados.andarAtirando) if not acao.is_empty() and acao.get("livre", false) else 1.0
	var alvo_mira = mira_mago()
	if alvo_mira != null:
		k_alvo = float(P.dados.andarAtirando) # andando de lado ou de costas: o mesmo passo de quem atira
	h.vel_k = move_toward(h.vel_k, k_alvo, dt * 4.0)
	if boss_mundo.preso(): # atordoado, congelado ou derrubado por skill de boss: não anda
		livre = false
	mov.passo(dt, dir.x, dir.z, forca >= 0.85, livre and h.lunge == null, h.vel_k * boss_mundo.lento())
	_dir_joy = Vector2(dir.x, dir.z) if forca > 0.15 else Vector2.ZERO
	_forca_joy = forca
	trabalho.passo_estamina(dt)
	passo_disparada(dt, forca)
	if not acao.is_empty() and acao.get("livre", false) and vivo(acao.get("alvo")):
		var da: Vector3 = acao.alvo.no.position - heroi.position
		mov.mirar(atan2(da.x, da.z))
	elif alvo_mira != null:
		var dm: Vector3 = alvo_mira.no.position - heroi.position
		mov.mirar(atan2(dm.x, dm.z))
	# pernas: virado para o alvo, anda de lado e de costas para onde o joystick manda (anim_heroi.gd)
	heroi_anim.mirando = alvo_mira != null and mov.chao and mov.esc == null and montaria == null and mov.manobra == null
	if heroi_anim.mirando:
		var s_ry := sin(mov.ry)
		var c_ry := cos(mov.ry)
		heroi_anim.dir_local = Vector2(mov.vx * c_ry - mov.vz * s_ry, mov.vx * s_ry + mov.vz * c_ry)
	heroi.position = mov.posicao()
	heroi.rotation.y = mov.ry
	passo_encostar(dt)
	# nado: entrou ou saiu da água funda
	var nada_agora: bool = mov.nadando() and h.morto <= 0.0
	if nada_agora != _nadando:
		_nadando = nada_agora
		if _nadando:
			if acao.get("canal", false):
				cancelar_canal()
			acao = {}
			_saindo_agua = 0.0
		elif mov.velocidade() > 0.4 and mov.chao and acao.is_empty() and heroi_anim.has_animation("sair_agua"):
			# chegou no raso nadando: as pernas descem e ele fica de pé (pedaço do Mixamo Swimming To Edge)
			_saindo_agua = heroi_anim.get_animation("sair_agua").length / SAIR_AGUA_RITMO
			heroi_anim.play("sair_agua", 0.3, SAIR_AGUA_RITMO)
		if mov.esc == null:
			armar(h.modo)
	_saindo_agua = maxf(0.0, _saindo_agua - dt)
	# mergulho (André 2026-11-06): segurar Afundar desce, segurar Subir volta para a superfície (andar.gd)
	mov.mergulho_dir = 0.0
	if _nadando:
		if hud.botao("afundar").get("apertado", false):
			mov.mergulho_dir = 1.0
		elif hud.botao("subir").get("apertado", false):
			mov.mergulho_dir = -1.0
	hud.mostrar_botao("afundar", _nadando)
	hud.mostrar_botao("subir", _nadando)
	# armas: escalando, as duas nas costas
	if mov.esc != null and not estava_escalando:
		acao = {}
		armar("Escalada")
	elif mov.esc == null and estava_escalando:
		armar(h.modo)
	# animação
	if mov.esc != null:
		if mov.anim != "" and (heroi_anim.current_animation != mov.anim or mov.clip_seq != _clip_visto) and heroi_anim.has_animation(mov.anim):
			_clip_visto = mov.clip_seq
			var clip_esc: bool = mov.anim.begins_with("esc_")
			var vel := 1.0
			if clip_esc:
				vel = heroi_anim.get_animation(mov.anim).length / max(0.05, float(mundo.escalada[mov.anim.substr(4)].dur))
			var mesma: bool = heroi_anim.current_animation == mov.anim
			heroi_anim.play(mov.anim, 0.12, vel)
			if mesma:
				heroi_anim.seek(0.0, true)
	elif acao.is_empty():
		var a := ""
		if _saindo_agua > 0.0 and not _nadando and mov.chao:
			a = "sair_agua" # termina de ficar de pé antes de andar
		elif _nadando:
			a = "andar" if mov.velocidade() > 0.3 else "parada" # quem troca para nadar/boiar é o anim_heroi.gd (nome para o servidor)
		elif montaria != null:
			a = "parada" # montado: quem anda é o lobo (cavalgar.gd põe o corpo na sela por cima)
		elif not mov.veiculo.is_empty():
			a = "parada" # no carrinho, no barco ou no navio: quem anda é o veículo (sentar.gd põe o corpo no banco)
		elif mov.manobra != null and heroi_anim.has_animation(mov.manobra.nome):
			a = mov.manobra.nome # freada e meia-volta: o corpo anda pelo caminho do quadril da animação (andar.gd)
		elif mov.arrancada != null:
			a = "corrida"
		elif mov.mortal > 0.0:
			a = "mortal"
		elif not mov.chao:
			a = "pulo" if mov.pulos == 1 and mov.vy > 0 and mov.pulo_t < 0.45 else "queda"
		elif mov.pouso > 0.0 and dir.length() < 0.15:
			a = "pouso"
		elif dir.length() > 0.15 or mov.velocidade() > 0.6:
			# a mistura parada/andar/corrida vem da velocidade de verdade (anim_heroi.gd); o nome é para o servidor
			a = "corrida" if mov.velocidade() > 3.2 else "andar"
		else:
			a = "parada" if h.modo == "Magia" else "espada_parada"
		if a != "sair_agua" and _saindo_agua > 0.0:
			_saindo_agua = 0.0 # pulou, caiu ou voltou para o fundo: corta a saída
		if heroi_anim.current_animation != a and heroi_anim.has_animation(a):
			# andar e correr no ritmo da velocidade: o pé acompanha o chão (sem parecer que desliza)
			if mov.manobra != null and a == mov.manobra.nome:
				heroi_anim.play(a, 0.1 if a == "meia_volta" else 0.15, mov.ritmo_manobra())
			else:
				# saindo da freada: o corpo se arruma devagar (mistura longa)
				heroi_anim.play(a, 0.35 if heroi_anim.current_animation == "freada" else 0.15, ritmo(a) if mov.arrancada == null else 1.0)
		elif mov.manobra != null and a == mov.manobra.nome:
			heroi_anim.ritmo_acao(mov.ritmo_manobra())
	# cajado na mão (modo magia): segue a mão e fica de pé, um pouco inclinado, com a mão fechada em volta dele
	# (montado as duas armas vão nas costas e a mão segura a juba)
	var mao_no_cajado: bool = cajado_na_mao() and cajado.visible
	mao_fechada.peso = move_toward(mao_fechada.peso, 1.0 if mao_no_cajado else 0.0, dt * 8.0)
	if cajado_na_mao():
		# meio do cajado na palma, não no punho (Armas.pose_na_mao; pedido do André, 2026-11-03)
		cajado.global_transform = Armas.pose_na_mao(heroi_esq, mao_direita, heroi, heroi_anim.peso_guarda())
		if cajado.visible and heroi.visible:
			Armas.chama(fx.mg, cajado, dt) # chama pintada no topo do Cajado A
	# rastro da espada durante o golpe e do vento no dash
	var lamina = null
	if not acao.is_empty() and acao.get("lamina", false) and h.modo == "Espada" and mov.esc == null:
		lamina = [espada.global_transform * Vector3(0, 0.2, 0), espada.global_transform * Vector3(0, 0.92, 0)]
	fx.corpo_passo(heroi, dt, mov.arrancada != null, lamina)
	sol.global_position = heroi.position
	corpo_vivo(dt, estava_no_chao)

# o que dá peso ao corpo: mistura da locomoção, inclinar na curva, afundar no pouso e o som dos passos
func corpo_vivo(dt: float, estava_no_chao: bool) -> void:
	var vel: float = mov.velocidade()
	var vel_anim: float = vel
	if mov.arrancada != null:
		vel_anim = mov.CORRIDA * 1.2
	elif not mov.chao or mov.esc != null or montaria != null or not mov.veiculo.is_empty():
		vel_anim = 0.0
	# postura de luta só em combate ou logo depois de um golpe/magia (fora disso, parada relaxada)
	if not acao.is_empty():
		_guarda_ate = tempo + GUARDA_DEPOIS
	heroi_anim.em_guarda = trabalho.em_combate() or tempo < _guarda_ate
	# parado com o cajado na mão: postura de mago em guarda (no chão, sem montaria e sem escalar)
	heroi_anim.guarda_cajado = h.modo == "Magia" and montaria == null and mov.chao and mov.esc == null and not _nadando
	heroi_anim.nadando = _nadando
	# parada solta fora de combate (André 2026-11-09) só em pé no chão, com as mãos livres
	heroi_anim.pode_soltar = montaria == null and mov.chao and mov.esc == null and mov.veiculo.is_empty() and not _nadando \
		and h.modo != "Coleta" and not (pesca != null and pesca.ativo())
	heroi_anim.atualizar(dt, vel_anim)
	if expressao:
		expressao.atualizar(dt)
	if montaria != null:
		montaria.passo(dt, vel)
	# Peso do corpo: molas que passam do ponto e voltam (o "tranco" da freada e da arrancada).
	# Arrancando, o tronco vai para a frente; freando, vai para trás e o quadril desce; quando para,
	# a mola joga o tronco para a frente e ele volta ao lugar. Na curva deita para dentro e, ao endireitar, volta balançando.
	var vel_antes: float = _vel_ant
	var _a_inst: float = clamp((vel - _vel_ant) / max(dt, 0.0001), -30.0, 30.0) # teleporte e fim do dash não viram tranco gigante
	_vel_ant = vel
	_acel = lerp(_acel, _a_inst, min(1.0, dt * 14.0))
	var livre_corpo: bool = mov.chao and mov.esc == null and mov.arrancada == null and mov.manobra == null and acao.is_empty() and montaria == null and mov.veiculo.is_empty() and not _nadando and _saindo_agua <= 0.0
	# arrancada: saindo do parado com o joystick todo, as pernas tocam a animação de sair correndo
	if heroi_anim.arrancando <= 0.0:
		if livre_corpo and vel_antes < 0.4 and _forca_joy > 0.85 and mov.vel_max > 4.0 and mov.disparada: # arranca só na disparada (o joystick sozinho trota)
			heroi_anim.arrancar(ARR_RITMO)
	elif heroi_anim.arrancando > ARR_FIM or not livre_corpo or _forca_joy < 0.15:
		heroi_anim.soltar_arrancada()
	var alvo_frente := 0.0
	var alvo_incl := 0.0
	if livre_corpo:
		alvo_frente = clamp(_acel * (0.016 if _acel > 0.0 else 0.02), -0.3, 0.2)
		# no trote o corpo deita na curva quase como na corrida (sem isso o trote ficava liso)
		alvo_incl = clamp(-mov.giro * vel * 0.022 * (1.0 + 0.25 * smoothstep(mov.ANDAR, mov.TROTE, vel) * (1.0 - clamp((vel - mov.TROTE) / (mov.CORRIDA - mov.TROTE), 0.0, 1.0))), -0.26, 0.26)
	_frente_v += ((alvo_frente - _frente) * MOLA_K - _frente_v * MOLA_AMORT) * dt
	_frente += _frente_v * dt
	_incl_v += ((alvo_incl - _incl) * MOLA_K * 0.8 - _incl_v * MOLA_AMORT) * dt
	_incl += _incl_v * dt
	# cansaço e respiração: depois de correr, parado, o peito sobe e desce forte e vai acalmando
	if vel > 3.5 and mov.chao:
		_cansaco = min(1.0, _cansaco + dt / 8.0)
	elif vel < 0.5:
		_cansaco = max(0.0, _cansaco - dt / 10.0)
	_respira += dt * TAU * lerp(0.28, 0.75, _cansaco)
	_resp_peso = move_toward(_resp_peso, 1.0 if livre_corpo and vel < 0.5 else 0.0, dt * 3.0)
	var resp: float = sin(_respira) * lerp(0.01, 0.05, _cansaco) * _resp_peso
	inclinar.frente = clamp(_frente + resp, -0.4, 0.3)
	# cabeça vira antes do corpo para onde o joystick aponta (o corpo vem logo atrás)
	var alvo_olhar := 0.0
	if livre_corpo and _dir_joy.length() > 0.1:
		alvo_olhar = clamp(mov.ad(atan2(_dir_joy.x, _dir_joy.y), mov.ry) * 0.6, -0.7, 0.7)
	_olhar = lerp(_olhar, alvo_olhar, min(1.0, dt * 12.0))
	inclinar.olhar = _olhar
	inclinar.inclinacao = clamp(_incl, -0.32, 0.32)
	var freada: float = clamp(-_acel / mov.FREIA, 0.0, 1.0) if livre_corpo else 0.0
	# pouso: câmera e quadril afundam, poeira e som (mesmo correndo)
	if mov.pousou > 0.0:
		var q: float = mov.pousou
		mov.pousou = 0.0
		cam.afundar(0.05 + q * 0.12)
		_quadril = 0.04 + q * 0.08
		sons.tocar("pouso_forte" if q > 0.6 else "pouso", -6.0 + q * 5.0, 0.08)
		fx.fumaca_chao(heroi.position.x, heroi.position.z, 0.5 + q * 0.5, int(4 + q * 8), "9a948a", 0.6 + q * 0.6)
		if q > 0.6:
			vibrar(25)
	elif mov.chao and not estava_no_chao:
		sons.tocar("pouso", -10.0, 0.08)
	_quadril = move_toward(_quadril, 0.0, dt * 0.5)
	# nadando o corpo sobe (cabeça e costas fora da água); saindo do lago desce aos poucos até os pés acharem o fundo
	var sobe_alvo := 0.0
	if _nadando:
		sobe_alvo = lerpf(SOBE_BOIANDO, SOBE_NADANDO, smoothstep(0.15, 0.9, vel))
	_sobe_agua = move_toward(_sobe_agua, sobe_alvo, dt * (0.9 if _saindo_agua > 0.0 else 0.6))
	inclinar.afunda = _quadril + freada * 0.035 - _sobe_agua
	# cajado nas costas nadando: desce para os pés conforme o corpo deita
	if _caj_base != null and _nadando and cajado.get_parent() is BoneAttachment3D:
		var b := heroi_esq.find_bone("J_Bip_C_UpperChest")
		if b >= 0:
			var desce: Vector3 = heroi_esq.get_bone_global_rest(b).basis.inverse() * Vector3(0, -CAJADO_NADO, 0)
			cajado.position = _caj_base + desce * heroi_anim._nada
	if agua_fx:
		agua_fx.passo(dt, heroi, heroi_esq, _nadando and mov.mergulho < 0.4, float(terreno.agua.nivel), heroi_anim._nada, vel, mov.ry, heroi_anim.voltas_nado)
	# passos: um som a cada passada (mais longa correndo), só no chão (nadando não tem passo)
	if mov.chao and mov.esc == null and vel > 0.5 and not _nadando and mov.veiculo.is_empty():
		_passo_dist += vel * dt
		var passada: float = lerp(0.75, 1.45, clamp((vel - 1.8) / 3.6, 0.0, 1.0))
		if montaria != null: # patas do lobo: passada mais longa no galope
			passada = lerp(0.9, 2.6, clamp((vel - 3.0) / 6.0, 0.0, 1.0))
		if _passo_dist >= passada:
			_passo_dist = 0.0
			if montaria != null: # o lobo tem som de patas próprio, não o passo do herói (André 2026-11-07)
				sons.tocar("pata", -6.0, 0.1)
			else:
				sons.tocar("passo", -14.0 + vel * 1.4, 0.12)
	else:
		_passo_dist = 0.6

# monstros não entram uns nos outros: 1,2 m entre os centros (raio de uns 0,6 m cada), como Simulacao.colidir
const SEPARACAO := 1.2
func separar_inimigos() -> void:
	var lista: Array = _ativos
	for i in lista.size():
		var a: Dictionary = lista[i]
		if a.estado == "morto" or a.get("treino", false): # o espantalho é obstáculo (mundo.obstaculos), não empurra nem é empurrado
			continue
		for j in range(i + 1, lista.size()):
			var b: Dictionary = lista[j]
			if b.estado == "morto" or b.get("treino", false):
				continue
			var d := Vector2(b.no.position.x - a.no.position.x, b.no.position.z - a.no.position.z)
			var l := d.length()
			if l < SEPARACAO:
				var n := d / l if l > 0.001 else Vector2(1, 0)
				var empurra := (SEPARACAO - l) * 0.5
				a.no.position -= Vector3(n.x, 0, n.y) * empurra
				b.no.position += Vector3(n.x, 0, n.y) * empurra

# História v2, Entrega 3: a gente das mini vilas do mundo grande (são 26, longe uma vila da outra). O corpo de cada um
# só nasce com o herói a menos de NPC_VILA_NASCE m (um por vez, a cada meio segundo: nada de travada) e sai da cena
# passando de NPC_VILA_SAI m. Antes disso não pesa nada no celular (nem memória, nem carregar na abertura).
const NPC_VILA_NASCE := 110.0
const NPC_VILA_SAI := 170.0
var npcs_vila: Array = [] # as fichas (mundo.json npcs com "vila")
var _npc_vila_t := 0.0
func npcs_das_vilas(dt: float) -> void:
	_npc_vila_t -= dt
	if _npc_vila_t > 0.0 or npcs_vila.is_empty():
		return
	_npc_vila_t = 0.5
	var hp: Vector3 = heroi.position
	var criou := false
	for info in npcs_vila:
		var d := Vector2(float(info.x) - hp.x, float(info.z) - hp.z).length()
		if info.get("depois") != null and nevoa != null and not nevoa.npc_apareceu(str(info.depois)):
			d = INF # só aparece depois dessa missão (o Kael em Aurora, história v2)
		var id := str(info.id)
		var n = null
		for o in npcs:
			if o.id == id:
				n = o
				break
		if n == null and d < NPC_VILA_NASCE and not criou:
			criar_npc(MODELO_NPC.get(id, str(info.get("visual", "vivi"))), Vector3(float(info.x), 0, float(info.z)), str(info.nome).get_slice(",", 0), info)
			criou = true
		elif n != null and d > NPC_VILA_SAI and (conversa == null or conversa.npc != n):
			npcs.erase(n)
			n.no.queue_free()

# monstro longe (outra clareira): a animação para (o corpo já não é desenhado: visibility_range_end em criar_inimigo).
# Online ele continua andando pelo que o servidor manda; sem internet ele não pensa (atualizar_inimigos)
func lod_inimigos() -> void:
	if heroi == null:
		return
	materializar_perto(get_process_delta_time())
	npcs_das_vilas(get_process_delta_time())
	var hp: Vector3 = heroi.position
	# NPCs (FPS 2026-11-07): longe como os monstros (outra ponta do mapa, 70 m), o NPC some e para de animar (o guardião
	# do leste animava e era desenhado com o herói na vila). Perto volta igual; a conversa e a loja só valem de perto.
	for n in npcs:
		var dn: float = n.no.position.distance_squared_to(hp)
		var longe_n: bool = dn > (NPC_LONGE + 5.0) * (NPC_LONGE + 5.0) if n.get("longe", false) else dn > NPC_LONGE * NPC_LONGE
		if longe_n != n.get("longe", false):
			n.longe = longe_n
			n.no.visible = not longe_n
			n.no.process_mode = Node.PROCESS_MODE_DISABLED if longe_n else Node.PROCESS_MODE_INHERIT
		# André 2026-11-07 (escolheu "as duas" no FPS da vila): NPC a mais de 15 m fica sem sombra e sem contorno
		var meio_n: bool = dn > NPC_DETALHE_SAI * NPC_DETALHE_SAI if n.get("simples", false) else dn > NPC_DETALHE * NPC_DETALHE
		if meio_n != n.get("simples", false):
			n.simples = meio_n
			npc_simples(n.no, meio_n)
			if not n.has("anim_p"):
				n.anim_p = n.no.find_child("AnimationPlayer", true, false)
				n.esq_p = esqueleto(n.no)
				n.fase = npcs.find(n)
			anim_espacada(n.anim_p, n.esq_p, meio_n)
			n.anim_acc = 0.0
		# FPS (auditoria 2026-11-11): longe do herói, o NPC anima a cada 2 quadros (a 25 m, a cada 3), no mesmo tempo total
		if meio_n and not longe_n and n.get("anim_p") != null:
			n.anim_acc = float(n.get("anim_acc", 0.0)) + get_process_delta_time()
			var passo_n: int = 3 if dn > NPC_ANIM_LONGE * NPC_ANIM_LONGE else 2
			if (Engine.get_process_frames() + int(n.fase)) % passo_n == 0:
				n.anim_p.advance(n.anim_acc)
				if n.esq_p:
					n.esq_p.advance(n.anim_acc)
				n.anim_acc = 0.0
		if not longe_n and not n.has("lod_pedido"): # roupa e cabelo montados no jogo ganham LOD (lod_malha.gd)
			n.lod_pedido = true
			LodMalha.pedir(n.no)
			pecinhas_de_perto(n.no)
	# FPS (auditoria 2026-11-11): a lista dos monstros perto é refeita a cada 4 quadros (são centenas no mapa; um
	# monstro que chega a LONGE_INIMIGO entra na lista no máximo 3 quadros depois)
	if Engine.get_process_frames() % 4 != 0 and not inimigos_perto.is_empty():
		return
	inimigos_perto.clear()
	for e in inimigos:
		var longe: bool = e.no.position.distance_squared_to(hp) > LONGE_INIMIGO * LONGE_INIMIGO
		if longe != e.get("longe", false):
			e.longe = longe
			if e.anim:
				e.anim.active = not longe
		if not longe:
			inimigos_perto.append(e)

# barra de vida do monstro: some quando ele está com a vida cheia e longe. Nome só do alvo atual (o mais perto, que o
# golpe pega sozinho) e de quem está em combate (levou ou deu dano nos últimos 5 s): três monstros juntos não encavalam
func barras_perto() -> void:
	var alvo = null
	var md := 12.0
	for e in inimigos_perto: # os longe (outra clareira) nem entram (lod_inimigos)
		if e.estado != "morto" and not e.get("longe", false):
			var d0: float = e.no.position.distance_to(heroi.position)
			if d0 < md:
				md = d0
				alvo = e
	for e in inimigos_perto:
		if e.barra == null or e.estado == "morto" or e.get("longe", false): # longe (outra clareira) nem é desenhado
			continue
		var d: float = e.no.position.distance_to(heroi.position)
		var v: bool = e.barra.scale.x < 0.999 or d < 9.0
		var nome: Node3D = e.barra.get_parent().get_child(e.barra.get_index() - 2)
		nome.visible = e == alvo or e == h.alvo_fixo or float(e.get("combate", 0.0)) > tempo
		if e.barra.visible != v:
			e.barra.visible = v
			e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = v
	empilhar_nomes()

# dois ou mais monstros a menos de 1,5 m: os nomes empilham (18 px entre eles) em vez de se encavalar;
# o "Firme!" fica no lugar do nome enquanto dura (direção de arte)
const NOME_OFFSET := 52.0
const NOME_PASSO := (14.0 + 18.0) * 72.0 / 14.0 # letra de 14 px + 18 px de espaço, em unidades da fonte (72)
const NOME_PASSO_M := 0.42 # m que cada nome empilhado sobe (com a barra junto)
func empilhar_nomes() -> void:
	var lista := []
	for e in inimigos_perto:
		if e.barra != null and e.estado != "morto" and not e.get("longe", false): # os de outras clareiras nem aparecem
			lista.append(e)
	if camera:
		lista.sort_custom(func(a, b): return a.no.global_position.distance_to(camera.global_position) < b.no.global_position.distance_to(camera.global_position))
	var feitos := []
	for e in lista:
		var nome: Label3D = e.barra.get_parent().get_child(e.barra.get_index() - 2)
		var k := 0
		for o in feitos:
			if Vector2(o.no.position.x - e.no.position.x, o.no.position.z - e.no.position.z).length() < 1.5:
				k += 1
		if nome.visible:
			feitos.append(e)
		# nome, fundo e barra sobem juntos (4 px entre nome e barra continuam iguais)
		var y_pilha: float = float(e.get("alto", 1.95)) + k * NOME_PASSO_M # alto: o lobo é mais baixo
		nome.position.y = y_pilha
		e.barra.position.y = y_pilha
		e.barra.get_parent().get_child(e.barra.get_index() - 1).position.y = y_pilha
		var c = combate._corpos.get(e.no)
		var firme_on: bool = c != null and c.firme_txt != null and is_instance_valid(c.firme_txt) and c.firme_txt.visible
		nome.modulate.a = 0.0 if firme_on else 1.0
		nome.outline_modulate.a = nome.modulate.a
		if firme_on:
			c.firme_txt.offset.y = nome.offset.y * 14.0 / 22.0
			c.firme_txt.position.y = nome.position.y

# Câmera não atravessa casa, telhado, pedra nem tronco: anda do herói até a câmera e para 0,2 m antes do que bater
# (copa de árvore deixa passar). Mesmas formas que o movimento usa (terreno.gd e obstáculos do mundo.json).
# sem_minerio: os veios de minério não puxam a câmera (André 2026-11-02: chegava perto e virava primeira pessoa)
# Desempenho (2026-11-03): antes, a cada passo de 0,2 m, juntava os 110 obstáculos do mapa com as árvores de perto e
# conferia as 22 pedras/casas do chão (uns 3 ms por quadro só na câmera, bem mais no celular). Agora separa uma vez só
# o que está perto da linha herói-câmera e confere só isso a cada passo (o resultado é o mesmo).
func distancia_livre(de: Vector3, dir: Vector3, ate: float, sem_minerio := false) -> float:
	var fim: Vector3 = de + dir * maxf(ate, 0.0)
	var a2 := Vector2(de.x, de.z)
	var b2 := Vector2(fim.x, fim.z)
	var perto: Array = []
	var vistos := {}
	for q in [de, (de + fim) * 0.5, fim]:
		for k in mov.perto_obstaculos(q.x, q.z) + mov.perto_na_mata(q.x, q.z):
			if vistos.has(k) or (k.has("veio") and mov.vazios.has(k.veio)): # veio esgotado não segura a câmera
				continue
			vistos[k] = true
			var c := Vector2(float(k.x), float(k.z))
			if Geometry2D.get_closest_point_to_segment(c, a2, b2).distance_to(c) < float(k.r) + 0.2:
				perto.append(k)
	var chao: Array = []
	# dentro de casa no modo jogo (André 2026-11-05, como no Quimera) a câmera não bate nas paredes nem no telhado da
	# casa: fica longe como lá fora e a parede que tapa a vista apaga (construcao.gd _telhados_visiveis)
	var sem_casa: bool = construcao != null and construcao.dentro_de_casa
	# FPS (2026-11-07): só os sólidos das casas de 4 m que a linha cruza (terreno.gd solidos_em), não todos os do mapa
	# (cada parede e fundação construída é um sólido). Mesmo resultado: quem não toca a linha já ficava de fora.
	var cand := []
	var vistos_s := {}
	var G: float = terreno.SOL_G
	for i in range(floori(minf(a2.x, b2.x) / G), floori(maxf(a2.x, b2.x) / G) + 1):
		for j in range(floori(minf(a2.y, b2.y) / G), floori(maxf(a2.y, b2.y) / G) + 1):
			for r in terreno.solidos_em(i * G + 0.5, j * G + 0.5):
				if not vistos_s.has(r._i): # _i: número do sólido (a grade põe)
					vistos_s[r._i] = true
					cand.append(r)
	for r in cand:
		if sem_casa and r.get("obra", false):
			continue
		var c := Vector2(r.x, r.z)
		if Geometry2D.get_closest_point_to_segment(c, a2, b2).distance_to(c) <= r.R:
			chao.append(r)
	var t := 0.35
	while t <= ate:
		var p := de + dir * t
		var h: float = terreno.altura_montanha(p.x, p.z) # a encosta da montanha também segura a câmera (lago: fica acima da água)
		var cv: float = terreno.chao_caverna(p.x, p.z, p.y + 0.45) # dentro da caverna: o chão dela (o teto e as paredes seguram)
		if not is_nan(cv) and cv < h:
			h = cv
		for r in chao:
			h = maxf(h, terreno.altura_na(r, p.x, p.z, p.y))
		if h > p.y - 0.25:
			return max(0.6, t - 0.2)
		for k in perto:
			if p.y < float(k.get("alto", 4.0)) and Vector2(p.x - k.x, p.z - k.z).length() < float(k.r) + 0.2:
				return max(0.6, t - 0.2)
		if trabalho and not sem_minerio and trabalho.dentro_de_pedra(p):
			return max(0.6, t - 0.2)
		t += 0.2
	return ate

# inimigos não atravessam casas, pedras, árvores e o poço (como Simulacao.colidir no servidor)
func colidir_inimigo(no: Node3D) -> void:
	var p := no.position
	for lista in [mov.perto_obstaculos(p.x, p.z), mundo.rochasInimigo, mov.perto_na_mata(p.x, p.z)]: # só os de perto (desempenho)
		for k in lista:
			if k.has("veio") and mov.vazios.has(k.veio):
				continue # veio esgotado: não está mais lá
			if k.has("base") and p.y < float(k.base) - 2.5:
				continue # árvore em cima da montanha (o monstro está na caverna embaixo)
			var dx: float = p.x - k.x
			var dz: float = p.z - k.z
			var d := sqrt(dx * dx + dz * dz)
			var mm: float = k.r + 0.35
			if d < mm and d > 0:
				p.x = k.x + dx / d * mm
				p.z = k.z + dz / d * mm
	for k in mundo.casasInimigo:
		var dx: float = p.x - k.x
		var dz: float = p.z - k.z
		var lx: float = dx * k.cos - dz * k.sin
		var lz: float = dx * k.sin + dz * k.cos
		var px: float = k.hw - abs(lx)
		var pz: float = k.hd - abs(lz)
		if px <= 0 or pz <= 0:
			continue
		var nx := lx
		var nz := lz
		if px < pz:
			nx = (1.0 if lx >= 0 else -1.0) * k.hw
		else:
			nz = (1.0 if lz >= 0 else -1.0) * k.hd
		p.x = k.x + nx * k.cos + nz * k.sin
		p.z = k.z - nx * k.sin + nz * k.cos
	var lim: Vector2 = mov.limitar_ao_mapa(p.x, p.z, 2.2) # não passa das pedras que fecham o mapa (como Simulacao.colidir)
	p.x = lim.x
	p.z = lim.y
	no.position = p

# ---------- campo de caça (regra do Quimera, igual a Simulacao.passoCacas do servidor) ----------
# sempre caca.n monstros: a cada caca.passo s, se falta algum (o corpo já sumiu), nasce um ao acaso no campo, longe
# do herói; o próximo vem em caca.rapido s com menos da metade vivos, senão em caca.normal s
var cacas: Array = []
func montar_cacas() -> void:
	for ci in mundo.get("caca", []).size():
		var c: Dictionary = mundo.caca[ci]
		var k := {"def": c, "vagas": [], "nx": 0.0, "t": 0.0}
		for i in c.tipos.size():
			_a_criar.append(criar_vaga.bind(k, ci, i)) # um monstro por vez (criar_aos_poucos), na ordem do servidor
		cacas.append(k)

# FASE 3 (mundo grande): os campos novos (caca.mundo) são 20 campos x 11 monstros. Para o celular não carregar ~220
# monstros que estão a centenas de metros, cada vaga deles começa como um lugar vazio na lista (o v do servidor não
# muda) e o modelo só nasce quando o herói chega a MUNDO_PERTO m do campo (ou o servidor manda o monstro).
const MUNDO_PERTO := 140.0
func criar_vaga(k: Dictionary, ci: int, i: int) -> void:
	var c: Dictionary = k.def
	if c.get("mundo", false) and (heroi == null or Vector2(heroi.position.x - float(c.x), heroi.position.z - float(c.z)).length() > MUNDO_PERTO):
		var no := Node3D.new()
		no.visible = false
		no.position = Vector3(float(c.x), 0, float(c.z))
		add_child(no)
		inimigos.append({"no": no, "anim": null, "barra": null, "estado": "morto", "vida": 0.0, "vida_max": 1.0, "tipo": str(c.tipos[i]),
			"vazio": true, "longe": true, "centro": no.position, "alvo": no.position, "morreu": -999.0, "caca": ci, "_k": k, "_i": i})
		return
	_criar_vaga(k, ci, i)

# monta o modelo de uma vaga vazia do mundo grande no mesmo lugar da lista (inimigos[v])
func materializar(e: Dictionary) -> void:
	if not e.get("vazio", false):
		return
	var k: Dictionary = e._k
	_criar_vaga(k, int(e.caca), int(e._i))
	var novo: Dictionary = inimigos.pop_back()
	k.vagas[k.vagas.find(novo)] = e
	e.no.queue_free()
	e.clear()
	e.merge(novo, true)

var _mundo_t := 0.0
func materializar_perto(dt: float) -> void:
	_mundo_t -= dt
	if _mundo_t > 0.0 or heroi == null:
		return
	_mundo_t = 1.0
	var hp := Vector2(heroi.position.x, heroi.position.z)
	var n := 0
	for e in inimigos:
		if e.get("vazio", false) and hp.distance_to(Vector2(e.centro.x, e.centro.z)) < MUNDO_PERTO:
			materializar(e)
			n += 1
			# um corpo por vez, a cada 0,1 s (até 10 por segundo): montar um monstro (modelo, tinta, contorno, nome) leva
			# ~5 ms no PC e uns 20 ms no celular; antes saíam 3 no mesmo quadro (engasgo de ~60 ms chegando num campo)
			if n >= 1:
				_mundo_t = 0.1
				return

func _criar_vaga(k: Dictionary, ci: int, i: int) -> void:
	var c: Dictionary = k.def
	var tipo := str(c.tipos[i])
	var nv := int(c.get("nivel", 1))
	var nome: String = NOME_TIPO.get(tipo, "Inimigo") + ("  Nv %d" % nv if c.has("nivel") else "")
	var bv: Dictionary = c.get("visual", {}) if c.has("boss") and i == 0 else {} # boss de mundo (boss_mundo.gd): maior, outra cor, nome dele
	if not bv.is_empty():
		nome = "%s  Nv %d" % [str(bv.get("nome", nome)), nv]
	var e := criar_inimigo(MODELO_TIPO.get(tipo, "puglin"), ponto_caca(c, true), nome, float(bv.get("esc", 1.0)) if not bv.is_empty() else (1.15 if tipo == "chefe" else 1.0))
	if not bv.is_empty():
		e.boss = str(c.boss)
		boss_mundo.vestir(e, bv)
	e.tipo = tipo
	e.nivel = nv
	for l in e.no.get_children(): # cor do nome pelo nível (Quimera); colorir_niveis troca quando o herói sobe
		if l is Label3D:
			l.modulate = cor_nivel(nv)
			break
	if tipo == "lobo": # bicho de quatro patas: nome e barra mais perto do lombo
		e.alto = 1.45 * float(bv.get("esc", 1.0))
	var st: Dictionary = c.get("status", {}).get(tipo, {}) # vida e dano no nível do campo (statusInimigo do servidor)
	e.vida_max = float(st.get("vida", VIDA_INIMIGO.get(tipo, D.INIMIGO.vida)))
	e.dano = float(st.get("dano", D.INIMIGO.dmg))
	e.vida = e.vida_max
	e.caca = ci
	e.centro = e.no.position
	k.vagas.append(e)
	entrou_online(e)

# monstro que nasceu da fila (criar_aos_poucos) depois que o jogo já entrou na sala: fica como os outros ficaram ao
# entrar (online.ao_entrar), parado esperando a foto do servidor
func entrou_online(e: Dictionary) -> void:
	if online and online.ligado:
		e.estado = "vivo"
		e.seq = -1
		e.uma_vez = 0.0
		e.alvo = e.no.position

# Tela de carregamento mais curta (2026-11-03): o que antes nascia tudo de uma vez no _ready (os 111 monstros dos
# campos de caça e os espantalhos) entra numa fila e nasce aos poucos, poucos milissegundos por quadro.
var _a_criar: Array = [] # Callables, na ordem em que precisam entrar em inimigos (o v do servidor)
func criar_aos_poucos() -> void:
	var t0 := Time.get_ticks_usec()
	while not _a_criar.is_empty() and Time.get_ticks_usec() - t0 < 4000:
		(_a_criar.pop_front() as Callable).call()

# Os modelos grandes (vila, corpos, monstros) começam a carregar todos juntos, em várias linhas do processador, logo no
# começo. Quando o código chega no load() de cada um, só espera o que ainda falta (antes era um depois do outro).
func pre_carregar() -> void:
	var lista := ["res://modelos/vila.glb", "res://modelos/ruiva.glb", "res://treino3d/Dummy.gltf", "res://modelos/arma_espada.glb",
		"res://armas3d/espada.glb", "res://armas3d/cajado.glb"]
	for n in mundo.get("npcs", []):
		lista.append("res://modelos/%s.glb" % MODELO_NPC.get(n.id, str(n.get("visual", "vivi"))))
	for t in MODELO_TIPO.values():
		lista.append("res://modelos/%s.glb" % t)
	var vistos := {}
	for p in lista:
		if not vistos.has(p) and ResourceLoader.exists(p):
			vistos[p] = true
			ResourceLoader.load_threaded_request(p, "", true)

# ponto ao acaso no campo (até caca.ate do raio), longe do herói e fora de árvore, pedra e veio
func ponto_caca(c: Dictionary, inicio := false):
	for t in 8:
		var a := randf() * TAU
		var r: float = sqrt(randf()) * float(c.r) * float(c.ate)
		var p := Vector3(float(c.x) + cos(a) * r, 0, float(c.z) + sin(a) * r)
		if c.has("tunel") and terreno: # covil dentro de caverna do mundo grande: no chão dela, longe da parede
			var cv: Dictionary = terreno.no_tunel(p.x, p.z)
			if cv.is_empty() or cv.id != str(c.tunel) or float(cv.d) > float(cv.l) - 1.0:
				continue
			p.y = float(cv.y)
		elif c.get("mundo", false) and terreno: # campo do mundo grande (FASE 3): platô acima do 0
			p.y = maxf(0.0, terreno.relevo(p.x, p.z))
		if not inicio and heroi and Vector2(p.x - heroi.position.x, p.z - heroi.position.z).length() < float(c.longe):
			continue
		var livre := true
		for k in mundo.obstaculos:
			if Vector2(p.x - float(k.x), p.z - float(k.z)).length() < float(k.r) + 0.8:
				livre = false
				break
		if livre:
			return p
	if inicio and c.has("tunel") and terreno: # covil: o meio da sala, no chão da caverna
		var cv0: Dictionary = terreno.no_tunel(float(c.x), float(c.z))
		return Vector3(float(c.x), float(cv0.get("y", 0.0)), float(c.z))
	return null if not inicio else Vector3(float(c.x), maxf(0.0, terreno.relevo(float(c.x), float(c.z))) if c.get("mundo", false) and terreno else 0.0, float(c.z))

func passo_cacas(dt: float) -> void:
	for k in cacas:
		var c: Dictionary = k.def
		k.t -= dt
		if k.t > 0.0:
			continue
		k.t = float(c.passo)
		var vivos := 0
		var vaga = null
		for e in k.vagas:
			if e.estado != "morto":
				vivos += 1
			elif vaga == null and tempo - e.get("morreu", 0.0) >= float(c.corpo):
				vaga = e
		if vaga == null or tempo < k.nx:
			continue
		var p = ponto_caca(c)
		if p == null:
			k.nx = tempo + float(c.rapido)
			continue
		k.nx = tempo + (float(c.rapido) if vivos < int(c.n) / 2.0 else float(c.normal))
		var e: Dictionary = vaga
		e.vida = e.vida_max
		e.estado = "vagar"
		e.no.position = p
		e.centro = p
		e.alvo = p
		e.barra.visible = true
		e.barra.scale.x = 1.0
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = true
		e.anim.play("espada_parada", 0.2)
		combate.voltou(e.no)

# ---------- espantalho de treino (pedido do André 2026-11-03) ----------
# Ao lado da ferraria (mundo.treino, de shared/dados.js MAPA_CLAREIRA.treino). Apanha de tudo e mostra o dano, mas
# não anda, não bate, não morre (a vida acaba e volta cheia na hora; parado `volta` s sem apanhar, enche de novo)
# e não dá XP nem item. Online quem decide é o servidor (Simulacao.ferirTreino); aqui é o mesmo sem internet.
# Modelo: Dummy do Fantasy Props MegaKit (Quaternius, CC0), em treino3d/. O balanço do golpe é a mola de combate.gd.
const ANIMS_TREINO := ["parada", "espada_parada", "andar", "corrida", "apanhar", "morrer", "golpe1", "golpe2"]
func montar_treino() -> void:
	for t in mundo.get("treino", []):
		if inimigos.size() != int(t.v): # o v do servidor é a posição na lista (depois das vagas da caça)
			push_warning("espantalho fora do lugar na lista: %d != %d" % [inimigos.size(), int(t.v)])
		inimigos.append(criar_espantalho(t))
		entrou_online(inimigos[-1])

func criar_espantalho(t: Dictionary) -> Dictionary:
	var no := Node3D.new()
	no.name = "Espantalho"
	add_child(no)
	var cena = load("res://treino3d/Dummy.gltf")
	if cena:
		var corpo: Node3D = cena.instantiate()
		no.add_child(corpo)
		pintar(corpo, false) # mesmo jeito pintado (toon) dos objetos da vila
	var pos := Vector3(float(t.x), 0, float(t.z))
	pos.y = terreno.altura(pos.x, pos.z) if terreno else 0.0
	no.position = pos
	no.rotation.y = float(t.get("ry", 0.0))
	# as mesmas animações que os monstros têm (o código de combate e o online chamam pelo nome); são paradas:
	# quem balança o espantalho no golpe é a mola de combate.gd (reacao)
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	var lib := AnimationLibrary.new()
	for nome in ANIMS_TREINO:
		var a := Animation.new()
		a.length = 0.45 if nome == "apanhar" else 1.0
		a.loop_mode = Animation.LOOP_NONE if nome == "apanhar" else Animation.LOOP_LINEAR
		lib.add_animation(nome, a)
	ap.add_animation_library("", lib)
	no.add_child(ap)
	ap.play("parada")
	var vida := float(t.get("vida", 1000))
	var e := {"no": no, "anim": ap, "vida": vida, "centro": pos, "estado": "treino", "t": 0.0, "alvo": pos, "cd": 0.0, "golpe": -1.0,
		"vida_max": vida, "tipo": str(t.get("tipo", "espantalho")), "treino": true, "volta": float(t.get("volta", 4.0)),
		"parado": 0.0, "lento": 0.0, "lento_k": 0.0, "vuln": 0.0, "vuln_k": 0.0, "puxao": Vector3.ZERO, "puxao_t": 0.0}
	e.barra = barra_vida(no, str(t.get("nome", "Espantalho de treino")), Color(0.85, 0.62, 0.25))
	nome_legivel(no)
	return e

# sem internet: o golpe no espantalho (como Simulacao.ferirTreino) — dano, número, tranco e efeitos; nunca morre
func ferir_treino(e: Dictionary, dmg: float, de: Vector3, hab = null) -> void:
	trabalho.combate()
	dmg *= randf_range(0.85, 1.15)
	var crit: bool = randf() < P.st.critico
	if crit:
		dmg *= 2.0
	if e.vuln > tempo:
		dmg *= 1.0 + e.vuln_k
	if h.get("contra_ate", 0.0) > tempo:
		dmg *= float(D.COMBATE.contraK)
		crit = true
		h.contra_ate = 0.0
	dmg = max(1.0, round(dmg))
	e.vida -= dmg
	if e.vida <= 0.0:
		e.vida = e.vida_max # acabou a vida: volta cheia na hora
	e.golpe_t = tempo
	e.combate = tempo + 5.0
	fx.numero(e.no.position, dmg, Color(1, 0.72, 0.25) if crit else Color(1, 0.95, 0.6), crit)
	var basico_hab: bool = hab is Dictionary and hab.has("combo")
	impacto_golpe(e.no.position, h.golpe_forte or not basico_hab, crit, basico_hab and h.modo == "Espada", tiro_basico(hab))
	piscar(e.no)
	combate.reacao(e.no, de, h.golpe_forte or not basico_hab)
	e.barra.scale.x = max(0.001, e.vida / e.vida_max)
	if hab is Dictionary:
		if hab.has("lento"):
			e.lento = tempo + hab.lento.dur
			e.lento_k = hab.lento.k
		if hab.has("vulneravel"):
			e.vuln = tempo + hab.vulneravel.dur
			e.vuln_k = hab.vulneravel.k
		for k in ["atordoa", "congela"]:
			if hab.has(k):
				e.parado = max(e.parado, tempo + hab[k])
				fx.status(e.no, k, hab[k])

# sem internet: o espantalho fica plantado; parado um tempo sem apanhar, a vida enche de novo
func passo_treino(e: Dictionary) -> void:
	if e.estado == "morto": # um servidor sem espantalho escondeu ele (online.aplicar_foto): sem internet ele volta
		e.estado = "treino"
		e.no.visible = true
		e.barra.visible = true
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = true
	if e.parado > tempo:
		return
	if e.vida < e.vida_max and tempo - e.get("golpe_t", -99.0) > e.volta:
		e.vida = e.vida_max
		e.barra.scale.x = 1.0

# entrou no campo de caça ou na zona de mineração: aviso com o nome (como o Quimera: "Zona de caça: ...")
var _zona_atual := ""
func avisar_zona() -> void:
	var z := ""
	for c in mundo.get("caca", []):
		if Vector2(heroi.position.x - float(c.x), heroi.position.z - float(c.z)).length() < float(c.r):
			z = "Zona de caça: " + str(c.nome)
	for c in mundo.get("mina", []):
		if Vector2(heroi.position.x - float(c.x), heroi.position.z - float(c.z)).length() < float(c.r) + 1.0:
			z = "Mineração: " + str(c.nome)
	if z != _zona_atual:
		_zona_atual = z
		if z != "":
			hud.aviso(z)

var _ativos: Array = [] # monstros perto do herói (os de outras clareiras ficam parados, sem pensar)
func atualizar_inimigos(dt: float) -> void:
	passo_cacas(dt)
	_ativos = []
	for e in inimigos:
		if (e.get("longe", false) and e.estado != "apanhar") or e.get("vazio", false): # vaga ainda sem corpo (chegou de teleporte)
			continue
		_ativos.append(e)
		if not e.get("treino", false): # o espantalho não sai do lugar
			colidir_inimigo(e.no)
	separar_inimigos()
	for e in _ativos:
		if e.get("treino", false):
			passo_treino(e)
			continue
		e.t -= dt
		e.cd -= dt
		var no: Node3D = e.no
		if e.puxao_t > 0.0: # puxado pelo vórtice
			e.puxao_t -= dt
			no.position += e.puxao * dt
		# atordoado ou congelado: fica parado (congelado até a animação para)
		if e.estado != "morto" and e.parado > tempo:
			continue
		if e.anim.speed_scale != 1.0:
			e.anim.speed_scale = 1.0
		match e.estado:
			"morto":
				if e.has("caca"): # campo de caça: quem volta é passo_cacas (outra vaga, outro lugar)
					continue
				if e.t <= 0.0:
					e.vida = e.vida_max
					e.estado = "vagar"
					no.position = e.centro
					e.barra.visible = true
					e.barra.scale.x = 1.0
					e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = true
					e.anim.play("espada_parada", 0.2)
					combate.voltou(no)
				continue
			"apanhar":
				if e.t <= 0.0:
					e.estado = "perseguir"
				continue
		var ate: Vector3 = heroi.position - no.position
		ate.y = 0
		var d := ate.length()
		if totem and totem.seguro(heroi.position): # área segura do totem: o monstro não persegue nem acerta
			d = 999.0
		if cinematica and cinematica.ativa: # vendo uma cena da história: o monstro deixa o herói em paz (como no servidor)
			d = 999.0
		var dy: float = abs(heroi.position.y - no.position.y)
		if e.golpe >= 0.0: # corte em andamento: preparo devagar, depois acerta perto da metade (como no servidor)
			e.golpe += dt
			if e.get("preparo", 0.0) > 0.0 and e.golpe >= e.preparo: # fim do preparo: o golpe sai rápido
				e.preparo = 0.0
				var pos_a: float = e.anim.current_animation_position
				e.anim.play(e.anim.current_animation, 0.0, D.COMBATE.golpeTs)
				e.anim.seek(pos_a, true)
			if e.golpe > e.golpe_at and not e.get("acertou", false):
				e.acertou = true
				if h.morto <= 0.0 and mov.esc == null and d < 6.0 and (mov.arrancada != null or acao.get("nome", "") == "rolar"):
					h.contra_ate = tempo + D.COMBATE.contraDur # rolou ou deu dash na hora: esquiva e contra-ataque
					combate.esquiva(heroi)
				elif d < 2.4 and dy < 1.3 and h.morto <= 0.0 and mov.esc == null:
					var nv_e: int = int(e.get("nivel", P.prog.nivel)) # diferença de nível (Quimera): dano e teto por golpe
					ferir_heroi(float(e.get("dano", D.INIMIGO.dmg)) * dano_monstro_nivel(nv_e), teto_monstro_nivel(nv_e, e.get("tipo", "") in CHEFES))
					e.combate = tempo + 5.0
			if e.golpe > e.golpe_dur:
				e.golpe = -1.0
			continue
		if e.get("vez", false) and (h.morto > 0.0 or d > 5.0):
			e.vez = false
		# no máximo COMBATE.aoMesmoTempo batem juntos; os outros rodeiam a COMBATE.roda m esperando a vez
		var na_vez := 0
		for o in inimigos:
			if o != e and o.estado != "morto" and o.get("vez", false):
				na_vez += 1
		var folga: bool = e.get("folga_ate", 0.0) > tempo # acabou de passar a vez: recua um pouco para outro entrar
		if h.morto <= 0.0 and not e.get("vez", false) and (folga or na_vez >= int(D.COMBATE.aoMesmoTempo)) and d < D.COMBATE.roda + 1.2:
			no.rotation.y = lerp_angle(no.rotation.y, atan2(ate.x, ate.z), min(1.0, dt * 8.0))
			var lado_r: float = 1.0 if inimigos.find(e) % 2 == 1 else -1.0
			var lado_v := Vector3(ate.z, 0, -ate.x).normalized() * lado_r * D.COMBATE.rodaVel
			no.position += (lado_v + ate.normalized() * (d - D.COMBATE.roda) * 1.5) * dt
			if e.anim.current_animation != "andar":
				e.anim.play("andar", 0.15)
		elif h.morto <= 0.0 and d < D.INIMIGO.visao:
			no.rotation.y = lerp_angle(no.rotation.y, atan2(ate.x, ate.z), min(1.0, dt * 8.0))
			if d > D.INIMIGO.alcance or dy >= 1.3:
				if d > 1.2:
					var longe: bool = d > float(D.COMBATE.chegarDist) # vai para cima correndo; só anda no último passo
					var v: float = (float(D.COMBATE.perseguir) if longe else float(D.COMBATE.chegar)) * ((1.0 - e.lento_k) if e.lento > tempo else 1.0)
					no.position += ate.normalized() * v * dt
					var a := "corrida" if longe else "andar"
					if e.anim.current_animation != a:
						e.anim.play(a, 0.15)
				elif e.anim.current_animation != "espada_parada":
					e.anim.play("espada_parada", 0.2)
			elif e.cd <= 0.0:
				e.cd = D.INIMIGO.ataque_cd
				e.golpe = 0.0
				e.acertou = false
				e.vez = true
				# preparo: o braço vai para trás bem devagar e o corpo acende vermelho; depois o golpe sai rápido
				var g := "golpe1" if randf() < 0.5 else "golpe2"
				var C: Dictionary = D.COMBATE
				var pr: float = float(C.preparo.get(e.tipo, 0.5))
				var L: float = e.anim.get_animation(g).length
				e.preparo = pr
				e.golpe_at = pr + max(0.05, L * C.acerto - pr * C.preparoTs) / C.golpeTs
				e.golpe_dur = pr + max(0.1, L - pr * C.preparoTs) / C.golpeTs
				e.cd = e.golpe_at + randf_range(float(C.cdMin), float(C.cdMax)) # Quimera: próximo golpe conta do acerto
				e.anim.play(g, 0.08, C.preparoTs)
				combate.preparo(no, pr)
				if randf() < 0.5:
					e.vez = false # passa a vez para quem está rodeando
					e.folga_ate = tempo + e.golpe_dur + float(D.COMBATE.folga)
			elif e.anim.current_animation != "espada_parada":
				e.anim.play("espada_parada", 0.2)
		else:
			# passeia perto de onde nasceu
			if e.t <= 0.0:
				e.t = randf_range(2.0, 5.0)
				e.alvo = e.centro + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
			var ir: Vector3 = e.alvo - no.position
			ir.y = 0
			if ir.length() > 0.3:
				no.position += ir.normalized() * 1.2 * dt
				no.rotation.y = lerp_angle(no.rotation.y, atan2(ir.x, ir.z), min(1.0, dt * 6.0))
				if e.anim.current_animation != "andar":
					e.anim.play("andar", 0.2)
			elif e.anim.current_animation != "espada_parada":
				e.anim.play("espada_parada", 0.2)

func ferir_heroi(dmg: float, teto := 99.0) -> void:
	if cinematica and cinematica.ativa: # vendo uma cena da história: ninguém bate (como no servidor, Simulacao.cena)
		return
	trabalho.combate()
	if trabalho.coletando != null:
		trabalho.parar(false)
	dmg = max(1.0, round(dmg * (1.0 - P.st.reducao)))
	dmg = max(1.0, min(dmg, round(float(P.st.vidaMax) * teto))) # um golpe não tira mais que o teto da vida (Quimera)
	if h.escudo > 0.0 and h.escudo_ate > tempo: # Escudo Arcano segura primeiro
		var seg: float = min(h.escudo, dmg)
		h.escudo -= seg
		dmg -= seg
		if h.escudo <= 0.0:
			fx.escudo_fim(heroi)
		if dmg <= 0.0:
			fx.numero(heroi.position, 0, Color(1, 0.9, 0.5))
			return
	h.vida -= dmg
	fx.numero(heroi.position, dmg, Color(1, 0.45, 0.4))
	apanhou()
	if acao.is_empty() and mov.esc == null and h.vida > 0.0: # a heroína sente o golpe (online vem do servidor igual)
		heroi_anim.play("apanhar", 0.05, 1.4)
	if h.vida <= 0.0:
		h.vida = 0.0
		h.morto = D.HEROI.renascer
		acao = {}
		volta.cancelar("")
		montar_lobo(false, false) # caiu: desce do lobo (o servidor também)
		heroi_anim.play("morrer", 0.1)
		if not on(): # penalidade (André 2026-11-05): online quem tira o ouro e desgasta é o servidor
			_penalidade_txt = P.penalidade_morte()

# caído (André 2026-11-05: "fiquei paralisado no céu"): antes, morto, nada do corpo andava, então a mistura da
# animação não ia para a de morte e o herói ficava duro em pé, ou parado no ar se caiu pulando. Agora a gravidade
# continua (desce até o chão) e a animação de morte (Mixamo, cai de costas) toca até o fim e fica deitada.
var _penalidade_txt := "" # sem internet: o que a morte custou, avisado quando levanta
func corpo_caido(dt: float) -> void:
	if mov.esc != null:
		mov.soltar()
	mov.arrancada = null
	mov.manobra = null
	mov.vx = 0.0
	mov.vz = 0.0
	mov.passo_vertical(dt)
	heroi.position = mov.posicao()
	if heroi_anim.current_animation != "morrer" and heroi_anim.has_animation("morrer"):
		heroi_anim.play("morrer", 0.1)
	heroi_anim.mirando = false
	heroi_anim.guarda_cajado = false
	heroi_anim.atualizar(dt, 0.0)
	mao_fechada.peso = move_toward(mao_fechada.peso, 0.0, dt * 8.0)
	if h.modo == "Magia" and montaria == null and cajado.visible and cajado.get_parent() == heroi: # o cajado cai junto com a mão (não fica no ar)
		cajado.global_transform = Armas.pose_na_mao(heroi_esq, mao_direita, heroi, heroi_anim.peso_guarda())

# o herói levou dano: tranco na câmera, som e vibração (offline e online)
func apanhou() -> void:
	volta.cancelar("Atacado! A volta para a vila parou")
	cam.tremer(0.45)
	hud.levou_dano()
	if expressao:
		expressao.levou_dano()
	sons.tocar("apanhar", -2.0, 0.1)
	vibrar(60)

# ---------- versão do jogo sempre à vista, desde a tela de carregamento (André 2026-11-09) ----------
func montar_versao() -> void:
	var tela := CanvasLayer.new()
	tela.layer = 50 # por cima de tudo (capa de login, HUD, menus); é pequeno e não pega toque
	add_child(tela)
	var l := Label.new()
	var n := str(load("res://versao.gd").NUMERO)
	l.text = "versão " + (n if n != "" else "dev")
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_theme_font_size_override("font_size", 13)
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.75))
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
	l.add_theme_constant_override("outline_size", 3)
	l.anchor_top = 1.0
	l.anchor_bottom = 1.0
	l.offset_left = 16
	l.offset_top = -26
	l.offset_right = 200
	l.offset_bottom = -6
	tela.add_child(l)

# ---------- teste de desempenho (botão Teste) ----------
func montar_teste() -> void:
	var tela := CanvasLayer.new()
	tela.layer = 2
	add_child(tela)
	_tela_teste = tela
	rotulo = Label.new()
	rotulo.add_theme_font_size_override("font_size", 15)
	rotulo.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	rotulo.add_theme_constant_override("outline_size", 4)
	rotulo.anchor_left = 1.0
	rotulo.anchor_right = 1.0
	rotulo.offset_left = -500
	rotulo.offset_right = -176 # à esquerda do minimapa (minimapa.gd)
	rotulo.offset_top = 182 # abaixo do botão Teste (o menu do topo fica no canto)
	rotulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	tela.add_child(rotulo)
	botao_teste = Button.new()
	botao_teste.text = "Teste"
	botao_teste.add_theme_font_size_override("font_size", 18)
	botao_teste.anchor_left = 1.0
	botao_teste.anchor_right = 1.0
	botao_teste.offset_left = -272
	botao_teste.offset_right = -176 # à esquerda do minimapa
	botao_teste.offset_top = 130 # abaixo do menu do topo (que fica na altura do centro do minimapa)
	botao_teste.offset_bottom = 172
	botao_teste.pressed.connect(comecar_teste)
	tela.add_child(botao_teste)
	etapas = [
		{"nome": "Normal (0.6x)", "f": func(): pass},
		{"nome": "Resolução cheia 1.0x", "f": func(): get_viewport().scaling_3d_scale = 1.0},
		{"nome": "Sem sombra", "f": func(): sol.shadow_enabled = false},
		{"nome": "Sem grama", "f": func(): _sem_grama()},
		{"nome": "20 personagens", "f": func(): mostrar_extras(true)},
		{"nome": "Resolução menor 0.45x", "f": func(): get_viewport().scaling_3d_scale = 0.45},
		{"nome": "Sem mato alto", "f": func(): mato.visible = false},
		{"nome": "Sem personagens", "f": func(): _esconder_gente(true)},
		{"nome": "Sem limite de FPS", "f": func(): Engine.max_fps = 0},
		{"nome": "Sem interface", "f": func(): _teste_desligar("interface")},
		{"nome": "Herói sem animação", "f": func(): _teste_desligar("heroi")},
		{"nome": "Sem monstros", "f": func(): _teste_desligar("monstros")},
	]
	get_tree().physics_frame.connect(_q_fisica)
	_q_paralelo = grafico != null and grafico.paralelo_agora()
	if _q_paralelo:
		# desenho em paralelo (APK 2026-11-12): o desenho roda em outra linha, então o quadro daqui é física + lógica +
		# espera (a linha principal parada esperando a tela ou a linha do desenho). A lógica acaba no último _process.
		get_tree().process_frame.connect(_q_par_proc)
		var ult := _UltimoQ.new()
		ult.name = "UltimoDoQuadro"
		ult.process_priority = 1 << 30
		ult.cb = func(): _q_ult = Time.get_ticks_usec()
		add_child(ult)
	else:
		get_tree().process_frame.connect(_q_logica)
		RenderingServer.frame_pre_draw.connect(_q_desenho)
		RenderingServer.frame_post_draw.connect(_q_fechar)

class _UltimoQ extends Node:
	var cb: Callable
	func _process(_d: float) -> void:
		cb.call()

var _q_paralelo := false
var _q_ult := 0
var _q_fis_ant := 0

func _q_par_proc() -> void:
	var agora := Time.get_ticks_usec()
	var ini: int = _q_fis if _q_fis > 0 and _q_fis <= agora else agora # começo desta volta (física, se teve)
	if _q_fim > 0 and _q_proc > 0 and _q_ult >= _q_proc:
		var v := {"quadro": ini - _q_fim, "fisica": _q_fis_ant, "logica": _q_ult - _q_proc, "desenho": 0}
		v.espera = max(0, v.quadro - v.fisica - v.logica)
		_q_somar(v)
	_q_fis_ant = agora - ini
	_q_fim = ini
	_q_proc = agora
	_q_fis = 0

func _q_somar(v: Dictionary) -> void:
	for k in v:
		q_ms[k] = lerp(float(q_ms[k]), v[k] / 1000.0, 0.05)
		if etapa >= 0 and t_etapa > ESPERA:
			soma_q[k] = soma_q.get(k, 0.0) + v[k] / 1000.0

func _q_fisica() -> void:
	if _q_fis == 0:
		_q_fis = Time.get_ticks_usec()

func _q_logica() -> void:
	_q_proc = Time.get_ticks_usec()

func _q_desenho() -> void:
	_q_pre = Time.get_ticks_usec()

func _q_fechar() -> void:
	var agora := Time.get_ticks_usec()
	if _q_fim > 0 and _q_proc > _q_fim and _q_pre >= _q_proc:
		var ini: int = _q_fis if _q_fis > _q_fim and _q_fis < _q_proc else _q_proc
		var v := {"quadro": agora - _q_fim, "fisica": _q_proc - ini, "logica": _q_pre - _q_proc, "desenho": agora - _q_pre}
		v.espera = v.quadro - v.fisica - v.logica - v.desenho
		_q_somar(v)
	_q_fim = agora
	_q_fis = 0

# etapas do Teste que desligam uma parte do jogo para ver quanto ela pesa no celular (restaurar() devolve tudo)
func _teste_guardar(o: Object, prop: String, v) -> void:
	_desligados_teste.append([o, prop, o.get(prop)])
	o.set(prop, v)

func _teste_desligar(qual: String) -> void:
	match qual:
		"interface": # as telas da HUD, do menu, do minimapa e do chat (fica só a do Teste)
			for c in get_tree().root.find_children("*", "CanvasLayer", true, false):
				if c != _tela_teste and c.visible:
					_teste_guardar(c, "visible", false)
		"heroi": # animação e ajustes de osso do herói (ele congela na pose; a capa fica dura)
			for a in heroi.find_children("*", "AnimationMixer", true, false):
				if a.active:
					_teste_guardar(a, "active", false)
			for mo in heroi.find_children("*", "SkeletonModifier3D", true, false):
				if mo.active:
					_teste_guardar(mo, "active", false)
		"monstros":
			for e in inimigos:
				if is_instance_valid(e.no):
					_teste_guardar(e.no, "visible", false)
					_teste_guardar(e.no, "process_mode", Node.PROCESS_MODE_DISABLED)

func _teste_religar() -> void:
	for i in range(_desligados_teste.size() - 1, -1, -1):
		var d: Array = _desligados_teste[i]
		if is_instance_valid(d[0]):
			d[0].set(d[1], d[2])
	_desligados_teste.clear()

# etapa do Teste: esconde os outros corpos (NPCs da vila, jogadores e bots) para ver quanto eles pesam
func _esconder_gente(v: bool) -> void:
	if v:
		var nos := []
		for n in npcs:
			nos.append(n.no)
		if online:
			for o in online.outros.values():
				nos.append(o.no)
				if o.get("montaria") != null:
					nos.append(o.montaria.no)
		for no in nos:
			if no is Node3D and is_instance_valid(no):
				_sem_gente.append([no, no.visible, no.process_mode])
				no.visible = false
				no.process_mode = Node.PROCESS_MODE_DISABLED
	else:
		for g in _sem_gente:
			if is_instance_valid(g[0]):
				g[0].visible = g[1]
				g[0].process_mode = g[2]
		_sem_gente.clear()

func _sem_grama() -> void:
	grama.visible = false
	mato.visible = false

func mostrar_extras(v: bool) -> void:
	if v and extras.is_empty():
		for i in EXTRAS.size():
			var a := TAU * i / EXTRAS.size()
			var no := modelo(EXTRAS[i])
			no.position = Vector3(cos(a) * 10.0, 0, sin(a) * 10.0)
			var an: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
			an.play("andar")
			extras.append(no)
	for no in extras:
		no.visible = v
		no.process_mode = Node.PROCESS_MODE_INHERIT if v else Node.PROCESS_MODE_DISABLED

func restaurar() -> void:
	get_viewport().scaling_3d_scale = RESOLUCAO_PADRAO
	sol.shadow_enabled = true
	grama.visible = true
	mato.visible = true
	mostrar_extras(false)
	_esconder_gente(false)
	_teste_religar()
	if grafico:
		grafico.aplicar() # volta para a qualidade gráfica escolhida

func comecar_teste() -> void:
	if not _q_paralelo:
		RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)
	resultados.clear()
	botao_teste.visible = false
	etapa = -1
	proxima_etapa()

func proxima_etapa() -> void:
	restaurar()
	etapa += 1
	if etapa >= etapas.size():
		etapa = -1
		botao_teste.visible = true
		RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), false)
		return
	etapas[etapa].f.call()
	t_etapa = 0.0
	quadros = 0
	soma_proc = 0.0
	soma_gpu = 0.0
	soma_rcpu = 0.0
	soma_q.clear()

func atualizar_teste(dt: float) -> void:
	var fps := Engine.get_frames_per_second()
	var txt := "%d FPS" % fps
	if online and online.ligado and online.rede.ping_ms >= 0: # André 2026-11-03: ping do servidor sempre à vista
		txt += " · ping %d ms" % online.rede.ping_ms
	if online:
		txt += "\nefeitos %.1f ms · online %.1f ms · rede %.1f ms" % [fx.ms, online.ms, online.rede.ms]
		txt += " · mato %.1f ms · capas %.1f ms · main %.1f ms" % [mato.ms if mato else 0.0, Armadura.PanoCapa.ms_quadro, ms_main] # auditoria de FPS 2026-11-11
	if _q_paralelo:
		txt += "\nquadro %.1f ms = física %.1f + lógica %.1f + espera %.1f (desenho em paralelo)" % [q_ms.quadro, q_ms.fisica, q_ms.logica, q_ms.espera]
	else:
		txt += "\nquadro %.1f ms = física %.1f + lógica %.1f + desenho %.1f + espera %.1f" % [q_ms.quadro, q_ms.fisica, q_ms.logica, q_ms.desenho, q_ms.espera]
	if etapa >= 0:
		var proc := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		t_etapa += dt
		if t_etapa > ESPERA:
			quadros += 1
			soma_proc += proc
			if not _q_paralelo: # em paralelo, ler o tempo da placa faz a linha principal esperar o desenho (distorce)
				soma_gpu += RenderingServer.viewport_get_measured_render_time_gpu(get_viewport().get_viewport_rid())
				soma_rcpu += RenderingServer.viewport_get_measured_render_time_cpu(get_viewport().get_viewport_rid())
		txt += "\nTestando %d/%d: %s…" % [etapa + 1, etapas.size(), etapas[etapa].nome]
		if t_etapa >= ESPERA + MEDE:
			var q: float = max(1, quadros)
			if _q_paralelo:
				resultados.append("%s: %.0f FPS · física %.1f · lógica %.1f · espera %.1f ms" % [etapas[etapa].nome, quadros / MEDE,
						soma_q.get("fisica", 0.0) / q, soma_q.get("logica", 0.0) / q, soma_q.get("espera", 0.0) / q])
			else:
				resultados.append("%s: %.0f FPS · física %.1f · lógica %.1f · desenho %.1f · espera %.1f · placa %.1f ms" % [etapas[etapa].nome, quadros / MEDE,
						soma_q.get("fisica", 0.0) / q, soma_q.get("logica", 0.0) / q, soma_q.get("desenho", 0.0) / q, soma_q.get("espera", 0.0) / q, soma_gpu / q])
			proxima_etapa()
	if not resultados.is_empty():
		txt += "\n" + "\n".join(resultados)
	# trocar o texto refaz a letra toda (caro no celular): só quando mudou (FPS, 2026-11-07) e no máximo 4 vezes por
	# segundo (auditoria 2026-11-11: os números do Teste mudam todo quadro, e o próprio Teste pesava na lógica)
	_rotulo_t -= dt
	if rotulo.text != txt and _rotulo_t <= 0.0:
		rotulo.text = txt
		_rotulo_t = 0.25
