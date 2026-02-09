/**
 * Seed: insere 4 projetos completos no Supabase para teste do dashboard.
 * Rodar: node scripts/seed-projects.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://lyaqsmgtqlahvyunooty.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5YXFzbWd0cWxhaHZ5dW5vb3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzQzMzUsImV4cCI6MjA4NjExMDMzNX0.XXADs33nbxXzcf4dZE4EH3jgmbQYrCcJkxOUUom0VTA'
)

/* ── Helpers ── */
let _id = 0
const uid = () => `seed-${++_id}-${Date.now()}`
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rnd(0, arr.length - 1)]

function labor(dept, role, name, unitType, unitCost, extraCost, qty) {
  return { id: uid(), type: 'labor', department: dept, roleFunction: role, itemName: name, unitType, unitCost, extraCost, quantity: qty, totalCost: 0 }
}
function cost(dept, supplier, item, unitType, unitCost, qty) {
  return { id: uid(), type: 'cost', department: dept, roleFunction: supplier, itemName: item, unitType, unitCost, extraCost: 0, quantity: qty, totalCost: 0 }
}
function verba(name, unitCost, qty = 1) {
  return { id: uid(), itemName: name, unitCost, quantity: qty, totalCost: 0 }
}
function cLine(dept, phase, name, role, type, isLabor, isVerba, unitCost, extraCost, qty, dailyH, addPct, otH, pay) {
  const val = isLabor ? (unitCost + extraCost) * qty : unitCost * qty
  return {
    id: uid(), department: dept, phase, name, role, type, isLabor, isVerba,
    finalValue: val, finalUnitCost: unitCost, finalExtraCost: extraCost, finalQuantity: qty,
    dailyHours: dailyH, additionalPct: addPct, overtimeHours: otH,
    invoiceNumber: `NF-${rnd(1000, 9999)}`, payStatus: pay,
  }
}
function expense(name, desc, value, pay) {
  return { id: uid(), name, description: desc, value, invoiceNumber: `NF-${rnd(1000, 9999)}`, payStatus: pay }
}

/* ══════════════════════════════════════════════
 * PROJETO 1 — Cerveja Aurora - Verão 2026
 * Grande comercial de TV — Budget alto
 * ══════════════════════════════════════════════ */
function project1() {
  const ini = {
    pre: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretor', 'Ricardo Mendes', 'dia', 6000, 400, 2),
        labor('DIREÇÃO', '1º Assist. Direção', 'Camila Torres', 'dia', 2000, 200, 2),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtor Executivo', 'Fernando Lima', 'dia', 4000, 0, 3),
        labor('PRODUÇÃO', 'Diretor de Produção', 'Juliana Costa', 'dia', 2500, 200, 3),
        labor('PRODUÇÃO', 'Assist. Produção', 'Lucas Almeida', 'dia', 800, 0, 3),
      ],
      'FOTOGRAFIA E TÉCNICA': [
        labor('FOTOGRAFIA E TÉCNICA', 'Diretor de Fotografia', 'André Nakamura', 'dia', 5000, 400, 2),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretor de Arte', 'Mariana Duarte', 'dia', 3000, 200, 3),
        labor('ARTE E CENOGRAFIA', 'Cenógrafo', 'Paulo Ribeiro', 'dia', 2000, 0, 3),
      ],
      'FIGURINO E MAQUIAGEM': [
        labor('FIGURINO E MAQUIAGEM', 'Figurinista', 'Beatriz Souza', 'dia', 2000, 150, 2),
      ],
    },
    prod: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretor', 'Ricardo Mendes', 'dia', 6000, 400, 3),
        labor('DIREÇÃO', '1º Assist. Direção', 'Camila Torres', 'dia', 2000, 200, 3),
        labor('DIREÇÃO', '2º Assist. Direção', 'Thiago Ramos', 'dia', 1200, 150, 3),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtor Executivo', 'Fernando Lima', 'dia', 4000, 0, 3),
        labor('PRODUÇÃO', 'Diretor de Produção', 'Juliana Costa', 'dia', 2500, 200, 3),
        labor('PRODUÇÃO', 'Produtora de Set', 'Carla Vieira', 'dia', 1800, 150, 3),
        labor('PRODUÇÃO', 'Assist. Produção', 'Lucas Almeida', 'dia', 800, 0, 3),
        labor('PRODUÇÃO', 'Assist. Produção', 'Marina Santos', 'dia', 800, 0, 3),
      ],
      'FOTOGRAFIA E TÉCNICA': [
        labor('FOTOGRAFIA E TÉCNICA', 'Diretor de Fotografia', 'André Nakamura', 'dia', 5000, 400, 3),
        labor('FOTOGRAFIA E TÉCNICA', '1º Assist. Câmera', 'Roberto Gomes', 'dia', 1500, 200, 3),
        labor('FOTOGRAFIA E TÉCNICA', 'Operador de Steadicam', 'Diego Ferreira', 'dia', 2500, 300, 2),
        labor('FOTOGRAFIA E TÉCNICA', 'Eletricista Chefe', 'Marcos Silva', 'dia', 1800, 200, 3),
        labor('FOTOGRAFIA E TÉCNICA', 'Maquinista Chefe', 'José Oliveira', 'dia', 1600, 200, 3),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretor de Arte', 'Mariana Duarte', 'dia', 3000, 200, 3),
        labor('ARTE E CENOGRAFIA', 'Cenógrafo', 'Paulo Ribeiro', 'dia', 2000, 0, 3),
        labor('ARTE E CENOGRAFIA', 'Contra-regra', 'Antônio Pereira', 'dia', 1200, 0, 3),
      ],
      'FIGURINO E MAQUIAGEM': [
        labor('FIGURINO E MAQUIAGEM', 'Figurinista', 'Beatriz Souza', 'dia', 2000, 150, 3),
        labor('FIGURINO E MAQUIAGEM', 'Maquiador(a)', 'Renata Lopes', 'dia', 1500, 100, 3),
        labor('FIGURINO E MAQUIAGEM', 'Camareira', 'Sofia Cunha', 'dia', 800, 0, 3),
      ],
      'SOM DIRETO': [
        labor('SOM DIRETO', 'Técnico de Som', 'Felipe Moura', 'dia', 2000, 200, 3),
        labor('SOM DIRETO', 'Microfonista', 'Gabriel Nunes', 'dia', 1000, 100, 3),
      ],
      'CASTING': [
        cost('CASTING', 'Elenco', 'Ator principal', 'cache', 15000, 1),
        cost('CASTING', 'Elenco', 'Atriz coadjuvante', 'cache', 8000, 1),
        cost('CASTING', 'Elenco', 'Figurantes (grupo)', 'cache', 500, 12),
      ],
      'EQUIPAMENTOS': [
        cost('EQUIPAMENTOS', 'Locadora Cine SP', 'ARRI Alexa Mini LF + Acessórios', 'cache', 8000, 3),
        cost('EQUIPAMENTOS', 'Locadora Cine SP', 'Kit Lentes Cooke S7', 'cache', 3500, 3),
        cost('EQUIPAMENTOS', 'Luz Filmes', 'Kit Iluminação ARRI + HMI', 'cache', 5000, 3),
        cost('EQUIPAMENTOS', 'Grip House', 'Kit Grip + Dolly + Crane', 'cache', 4000, 3),
        cost('EQUIPAMENTOS', 'Monitor Pro', 'Monitor SmallHD 4K + Wireless', 'cache', 1500, 3),
      ],
      'LOCAÇÕES': [
        cost('LOCAÇÕES', 'Praia Premium', 'Beach house + praia', 'cache', 12000, 2),
        cost('LOCAÇÕES', 'Estúdio Central', 'Estúdio para cenas internas', 'cache', 6000, 1),
      ],
      'TRANSPORTE': [
        cost('TRANSPORTE', 'TransCine', 'Van produção (3 veículos)', 'cache', 1800, 3),
        cost('TRANSPORTE', 'TransCine', 'Caminhão equipamento', 'cache', 2500, 3),
      ],
      'CATERING': [
        cost('CATERING', 'Sabor de Set', 'Almoço + coffee equipe (30 pax)', 'cache', 4500, 3),
      ],
      'DESPESAS GERAIS': [
        cost('DESPESAS GERAIS', 'Diversos', 'Seguro equipamento', 'cache', 3000, 1),
        cost('DESPESAS GERAIS', 'Diversos', 'Material de set', 'cache', 1500, 1),
      ],
    },
    pos: {
      'FINALIZAÇÃO': [
        labor('FINALIZAÇÃO', 'Editor', 'Rodrigo Campos', 'sem', 6000, 0, 3),
        labor('FINALIZAÇÃO', 'Colorista', 'Ana Paula Vieira', 'dia', 3500, 0, 4),
      ],
      'ANIMAÇÃO': [
        labor('ANIMAÇÃO', 'Motion Designer', 'Vinicius Costa', 'dia', 2500, 0, 5),
      ],
      'VFX': [
        labor('VFX', 'Compositor VFX', 'Daniel Martins', 'dia', 3000, 0, 6),
        labor('VFX', 'Supervisor VFX', 'Larissa Freitas', 'dia', 4000, 0, 3),
      ],
      'ÁUDIO': [
        labor('ÁUDIO', 'Sound Designer', 'Bruno Azevedo', 'dia', 2500, 0, 4),
        labor('ÁUDIO', 'Mixador', 'Patrícia Lima', 'dia', 3000, 0, 2),
      ],
    },
  }

  const vIni = {
    pre: {
      'PRODUÇÃO': [verba('Pesquisa de locação', 2000), verba('Aluguel escritório pré', 3000)],
      'ARTE E CENOGRAFIA': [verba('Compra materiais cenário', 8000)],
    },
    prod: {
      'PRODUÇÃO': [verba('Estacionamento + pedágios', 1500)],
      'FOTOGRAFIA E TÉCNICA': [verba('Consumíveis (baterias, mídias)', 3000)],
    },
    pos: {},
  }

  const mini = { contingencia: 12000, crt: 5000, bvagencia: 8000 }

  // --- Final budget (variações) ---
  const fin = JSON.parse(JSON.stringify(ini))
  // Prod: director gets an extra day
  fin.prod['DIREÇÃO'][0].quantity = 4
  fin.prod['DIREÇÃO'][0].unitCost = 6500
  // New crew member added
  fin.prod['PRODUÇÃO'].push(labor('PRODUÇÃO', 'Runner', 'Pedro Mendes', 'dia', 600, 0, 4))
  // Equipment slightly more expensive
  fin.prod['EQUIPAMENTOS'][0].unitCost = 8500
  fin.prod['EQUIPAMENTOS'][2].unitCost = 5500
  // Extra location day
  fin.prod['LOCAÇÕES'][0].quantity = 3
  // Catering increased (more crew)
  fin.prod['CATERING'][0].unitCost = 5200
  // Post: more VFX days
  fin.pos['VFX'][0].quantity = 8
  fin.pos['VFX'][1].quantity = 4

  const vFin = JSON.parse(JSON.stringify(vIni))
  vFin.prod['FOTOGRAFIA E TÉCNICA'] = [verba('Consumíveis (baterias, mídias)', 4500)]

  const miniFin = { contingencia: 15000, crt: 5000, bvagencia: 8000 }

  // --- Closing lines (from final budget) ---
  const closing = []
  for (const [phase, depts] of Object.entries(fin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const r of rows) {
        const isLab = r.type === 'labor'
        closing.push(cLine(dept, phase, r.itemName, r.roleFunction, r.unitType, isLab, false,
          r.unitCost, r.extraCost, r.quantity,
          isLab ? pick([8, 10, 12]) : 8,
          isLab ? pick([0, 0, 0, 20, 30]) : 0,
          isLab ? pick([0, 0, 0, 1, 2]) : 0,
          pick(['pago', 'pago', 'pago', 'pendente'])
        ))
      }
    }
  }
  // Verbas as closing
  for (const [phase, depts] of Object.entries(vFin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const v of rows) {
        closing.push(cLine(dept, phase, v.itemName, '', 'verba', false, true, v.unitCost, 0, v.quantity, 8, 0, 0, pick(['pago', 'pago', 'pendente'])))
      }
    }
  }

  const expenses = [
    expense('Uber equipe', 'Deslocamento dia 1', 850, 'pago'),
    expense('Farmácia', 'Kit primeiros socorros', 320, 'pago'),
    expense('Papelaria', 'Impressões call sheet', 180, 'pago'),
  ]

  return {
    job_id: 'BZ4521',
    nome: 'Cerveja Aurora - Verão 2026',
    agencia: 'Agência Criativa',
    cliente: 'Cervejaria Aurora',
    duracao: '30',
    duracao_unit: 'segundos',
    status: { initial: 'locked', final: 'locked', closing: 'locked' },
    budget_lines_initial: ini,
    verba_lines_initial: vIni,
    mini_tables: mini,
    job_value: 420000,
    tax_rate: 12.5,
    budget_lines_final: fin,
    verba_lines_final: vFin,
    mini_tables_final: miniFin,
    job_value_final: 420000,
    tax_rate_final: 12.5,
    notes_initial: { pre: '', prod: '3 diárias de filmagem — locação praia', pos: '' },
    notes_final: { pre: '', prod: 'Adicionada 1 diária extra de direção', pos: 'VFX expandido' },
    closing_lines: [closing, expenses],
  }
}

/* ══════════════════════════════════════════════
 * PROJETO 2 — Banco Nacional - Institucional
 * Vídeo corporativo — Budget médio
 * ══════════════════════════════════════════════ */
function project2() {
  const ini = {
    pre: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretor', 'Patrícia Neves', 'dia', 4000, 200, 2),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtor Executivo', 'Marcos Teixeira', 'dia', 3000, 0, 2),
        labor('PRODUÇÃO', 'Assist. Produção', 'Isabela Franco', 'dia', 700, 0, 2),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretor de Arte', 'Luísa Prado', 'dia', 2500, 0, 2),
      ],
    },
    prod: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretor', 'Patrícia Neves', 'dia', 4000, 200, 2),
        labor('DIREÇÃO', '1º Assist. Direção', 'Hugo Barbosa', 'dia', 1500, 150, 2),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtor Executivo', 'Marcos Teixeira', 'dia', 3000, 0, 2),
        labor('PRODUÇÃO', 'Diretor de Produção', 'Aline Moreira', 'dia', 2000, 150, 2),
        labor('PRODUÇÃO', 'Assist. Produção', 'Isabela Franco', 'dia', 700, 0, 2),
      ],
      'FOTOGRAFIA E TÉCNICA': [
        labor('FOTOGRAFIA E TÉCNICA', 'Diretor de Fotografia', 'Gustavo Herrera', 'dia', 4000, 300, 2),
        labor('FOTOGRAFIA E TÉCNICA', '1º Assist. Câmera', 'Leandro Faria', 'dia', 1200, 150, 2),
        labor('FOTOGRAFIA E TÉCNICA', 'Eletricista Chefe', 'Wagner Costa', 'dia', 1500, 150, 2),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretor de Arte', 'Luísa Prado', 'dia', 2500, 0, 2),
      ],
      'FIGURINO E MAQUIAGEM': [
        labor('FIGURINO E MAQUIAGEM', 'Maquiador(a)', 'Cíntia Rocha', 'dia', 1200, 100, 2),
      ],
      'SOM DIRETO': [
        labor('SOM DIRETO', 'Técnico de Som', 'Eduardo Santos', 'dia', 1800, 150, 2),
      ],
      'CASTING': [
        cost('CASTING', 'Elenco', 'Ator institucional', 'cache', 5000, 1),
        cost('CASTING', 'Elenco', 'Figurantes corporativos', 'cache', 400, 6),
      ],
      'EQUIPAMENTOS': [
        cost('EQUIPAMENTOS', 'Locadora RJ', 'Sony Venice + Acessórios', 'cache', 5000, 2),
        cost('EQUIPAMENTOS', 'Locadora RJ', 'Kit Lentes Zeiss', 'cache', 2000, 2),
        cost('EQUIPAMENTOS', 'Locadora RJ', 'Kit Iluminação LED', 'cache', 3000, 2),
      ],
      'LOCAÇÕES': [
        cost('LOCAÇÕES', 'Banco Nacional', 'Sede corporativa (cedida)', 'cache', 0, 2),
        cost('LOCAÇÕES', 'Rooftop Lounge', 'Cobertura para entrevistas', 'cache', 4000, 1),
      ],
      'TRANSPORTE': [
        cost('TRANSPORTE', 'LocaCar', 'Van produção (2 veículos)', 'cache', 1200, 2),
      ],
      'CATERING': [
        cost('CATERING', 'Gourmet Set', 'Almoço + coffee (18 pax)', 'cache', 2700, 2),
      ],
      'DESPESAS GERAIS': [
        cost('DESPESAS GERAIS', 'Diversos', 'Seguro equipamento', 'cache', 1500, 1),
      ],
    },
    pos: {
      'FINALIZAÇÃO': [
        labor('FINALIZAÇÃO', 'Editor', 'Tatiana Mello', 'sem', 5000, 0, 2),
        labor('FINALIZAÇÃO', 'Colorista', 'Leonardo Dias', 'dia', 3000, 0, 3),
      ],
      'ÁUDIO': [
        labor('ÁUDIO', 'Sound Designer', 'Fábio Correia', 'dia', 2000, 0, 3),
        labor('ÁUDIO', 'Locutor', 'Ricardo Voz', 'flat', 4000, 0, 1),
      ],
    },
  }

  const vIni = {
    pre: { 'PRODUÇÃO': [verba('Pesquisa locação', 1000)] },
    prod: { 'FOTOGRAFIA E TÉCNICA': [verba('Mídias e baterias', 1500)] },
    pos: {},
  }

  const mini = { contingencia: 6000, crt: 3000, bvagencia: 4000 }

  // Final: slightly adjusted
  const fin = JSON.parse(JSON.stringify(ini))
  fin.prod['FOTOGRAFIA E TÉCNICA'].push(labor('FOTOGRAFIA E TÉCNICA', 'Maquinista', 'João Pedro', 'dia', 1300, 100, 2))
  fin.prod['EQUIPAMENTOS'][0].unitCost = 5500
  fin.prod['CATERING'][0].unitCost = 3000
  fin.pos['FINALIZAÇÃO'][0].quantity = 3

  const vFin = JSON.parse(JSON.stringify(vIni))
  const miniFin = { contingencia: 7000, crt: 3000, bvagencia: 4000 }

  const closing = []
  for (const [phase, depts] of Object.entries(fin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const r of rows) {
        const isLab = r.type === 'labor'
        closing.push(cLine(dept, phase, r.itemName, r.roleFunction, r.unitType, isLab, false,
          r.unitCost, r.extraCost, r.quantity,
          isLab ? pick([8, 10]) : 8, isLab ? pick([0, 0, 20]) : 0, isLab ? pick([0, 0, 1]) : 0,
          pick(['pago', 'pago', 'pendente'])
        ))
      }
    }
  }
  for (const [phase, depts] of Object.entries(vFin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const v of rows) {
        closing.push(cLine(dept, phase, v.itemName, '', 'verba', false, true, v.unitCost, 0, v.quantity, 8, 0, 0, 'pago'))
      }
    }
  }
  const expenses = [
    expense('Estacionamento', 'Estac. equipe 2 dias', 400, 'pago'),
    expense('Papelaria', 'Impressões roteiro', 120, 'pago'),
  ]

  return {
    job_id: 'BZ2718',
    nome: 'Banco Nacional - Institucional',
    agencia: 'WPP Brasil',
    cliente: 'Banco Nacional S.A.',
    duracao: '2',
    duracao_unit: 'minutos',
    status: { initial: 'locked', final: 'locked', closing: 'open' },
    budget_lines_initial: ini,
    verba_lines_initial: vIni,
    mini_tables: mini,
    job_value: 200000,
    tax_rate: 11,
    budget_lines_final: fin,
    verba_lines_final: vFin,
    mini_tables_final: miniFin,
    job_value_final: 200000,
    tax_rate_final: 11,
    notes_initial: { pre: '', prod: '2 diárias — sede banco + rooftop', pos: '' },
    notes_final: { pre: '', prod: 'Maquinista adicionado', pos: 'Edição estendida para 3 semanas' },
    closing_lines: [closing, expenses],
  }
}

/* ══════════════════════════════════════════════
 * PROJETO 3 — Cosmético Bela - Campanha Digital
 * Budget menor, foco em beleza/moda
 * ══════════════════════════════════════════════ */
function project3() {
  const ini = {
    pre: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretora', 'Gabriela Mendonça', 'dia', 3500, 200, 1),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtora Executiva', 'Danielle Reis', 'dia', 2500, 0, 2),
        labor('PRODUÇÃO', 'Assist. Produção', 'Thaís Oliveira', 'dia', 600, 0, 2),
      ],
      'FIGURINO E MAQUIAGEM': [
        labor('FIGURINO E MAQUIAGEM', 'Maquiador(a) Chefe', 'Priscila Lemos', 'dia', 2500, 200, 2),
      ],
    },
    prod: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretora', 'Gabriela Mendonça', 'dia', 3500, 200, 2),
        labor('DIREÇÃO', '1º Assist. Direção', 'Rafael Braga', 'dia', 1200, 100, 2),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtora Executiva', 'Danielle Reis', 'dia', 2500, 0, 2),
        labor('PRODUÇÃO', 'Assist. Produção', 'Thaís Oliveira', 'dia', 600, 0, 2),
      ],
      'FOTOGRAFIA E TÉCNICA': [
        labor('FOTOGRAFIA E TÉCNICA', 'Diretora de Fotografia', 'Simone Araújo', 'dia', 3500, 300, 2),
        labor('FOTOGRAFIA E TÉCNICA', '1º Assist. Câmera', 'Caio Rodrigues', 'dia', 1000, 100, 2),
        labor('FOTOGRAFIA E TÉCNICA', 'Eletricista', 'Anderson Silva', 'dia', 1200, 100, 2),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretora de Arte', 'Clara Monteiro', 'dia', 2000, 0, 2),
      ],
      'FIGURINO E MAQUIAGEM': [
        labor('FIGURINO E MAQUIAGEM', 'Maquiador(a) Chefe', 'Priscila Lemos', 'dia', 2500, 200, 2),
        labor('FIGURINO E MAQUIAGEM', 'Maquiador(a)', 'Vanessa Cruz', 'dia', 1500, 100, 2),
        labor('FIGURINO E MAQUIAGEM', 'Figurinista', 'Elaine Borges', 'dia', 1800, 100, 2),
        labor('FIGURINO E MAQUIAGEM', 'Cabeleireiro(a)', 'Kátia Nogueira', 'dia', 1500, 100, 2),
      ],
      'SOM DIRETO': [
        labor('SOM DIRETO', 'Técnico de Som', 'Rogério Leal', 'dia', 1500, 100, 2),
      ],
      'CASTING': [
        cost('CASTING', 'Modelo', 'Modelo principal', 'cache', 8000, 1),
        cost('CASTING', 'Modelo', 'Modelo secundária', 'cache', 4000, 1),
      ],
      'EQUIPAMENTOS': [
        cost('EQUIPAMENTOS', 'Studio Rent', 'RED Raptor + Acessórios', 'cache', 4500, 2),
        cost('EQUIPAMENTOS', 'Studio Rent', 'Kit Lentes Leica', 'cache', 2500, 2),
        cost('EQUIPAMENTOS', 'Luz Pro', 'Kit Beauty Light (Softbox + Ring)', 'cache', 2000, 2),
      ],
      'LOCAÇÕES': [
        cost('LOCAÇÕES', 'Estúdio Branco', 'Estúdio infinity wall', 'cache', 5000, 2),
      ],
      'TRANSPORTE': [
        cost('TRANSPORTE', 'Locadora', 'Van produção', 'cache', 900, 2),
      ],
      'CATERING': [
        cost('CATERING', 'Natural Food', 'Almoço saudável + coffee (16 pax)', 'cache', 2400, 2),
      ],
      'DESPESAS GERAIS': [
        cost('DESPESAS GERAIS', 'Diversos', 'Materiais consumíveis beauty', 'cache', 2000, 1),
      ],
    },
    pos: {
      'FINALIZAÇÃO': [
        labor('FINALIZAÇÃO', 'Editora', 'Juliana Fonseca', 'sem', 4500, 0, 2),
        labor('FINALIZAÇÃO', 'Colorista', 'Henrique Lima', 'dia', 3000, 0, 3),
      ],
      'VFX': [
        labor('VFX', 'Retocador Beauty', 'Amanda Pinto', 'dia', 2500, 0, 4),
      ],
      'ÁUDIO': [
        labor('ÁUDIO', 'Mixador', 'Paulo Sampaio', 'dia', 2000, 0, 2),
      ],
    },
  }

  const vIni = {
    pre: { 'PRODUÇÃO': [verba('Compra de props beauty', 3000)] },
    prod: { 'FOTOGRAFIA E TÉCNICA': [verba('Consumíveis foto', 1200)] },
    pos: {},
  }

  const mini = { contingencia: 5000, crt: 2000, bvagencia: 3000 }

  // Final: some cuts and additions
  const fin = JSON.parse(JSON.stringify(ini))
  // Cut one model
  fin.prod['CASTING'] = [cost('CASTING', 'Modelo', 'Modelo principal', 'cache', 10000, 1)]
  // Add drone shots
  fin.prod['EQUIPAMENTOS'].push(cost('EQUIPAMENTOS', 'Drone Films', 'DJI Inspire 3 + Piloto', 'cache', 3500, 1))
  // Less VFX needed
  fin.pos['VFX'][0].quantity = 3
  // More color grading
  fin.pos['FINALIZAÇÃO'][1].quantity = 4

  const vFin = JSON.parse(JSON.stringify(vIni))
  vFin.pre['PRODUÇÃO'] = [verba('Compra de props beauty', 4500)]

  const miniFin = { contingencia: 4000, crt: 2000, bvagencia: 3000 }

  const closing = []
  for (const [phase, depts] of Object.entries(fin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const r of rows) {
        const isLab = r.type === 'labor'
        closing.push(cLine(dept, phase, r.itemName, r.roleFunction, r.unitType, isLab, false,
          r.unitCost, r.extraCost, r.quantity,
          isLab ? pick([8, 10]) : 8, isLab ? pick([0, 0]) : 0, isLab ? pick([0, 0, 1]) : 0,
          pick(['pago', 'pago', 'pago', 'pendente'])
        ))
      }
    }
  }
  for (const [phase, depts] of Object.entries(vFin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const v of rows) {
        closing.push(cLine(dept, phase, v.itemName, '', 'verba', false, true, v.unitCost, 0, v.quantity, 8, 0, 0, 'pago'))
      }
    }
  }
  const expenses = [
    expense('Material maquiagem extra', 'Compra emergencial', 750, 'pago'),
    expense('Lavanderia figurino', 'Limpeza peças', 350, 'pago'),
  ]

  return {
    job_id: 'BZ3392',
    nome: 'Cosmético Bela - Campanha Digital',
    agencia: 'Beauty House Comunicação',
    cliente: 'Cosmético Bela Ltda.',
    duracao: '45',
    duracao_unit: 'segundos',
    status: { initial: 'locked', final: 'locked', closing: 'locked' },
    budget_lines_initial: ini,
    verba_lines_initial: vIni,
    mini_tables: mini,
    job_value: 160000,
    tax_rate: 10,
    budget_lines_final: fin,
    verba_lines_final: vFin,
    mini_tables_final: miniFin,
    job_value_final: 160000,
    tax_rate_final: 10,
    notes_initial: { pre: 'Pré com foco em beauty e figurino', prod: '2 diárias estúdio', pos: '' },
    notes_final: { pre: '', prod: 'Drone adicionado, modelo única', pos: 'Retouch ajustado' },
    closing_lines: [closing, expenses],
  }
}

/* ══════════════════════════════════════════════
 * PROJETO 4 — Auto Motor - Lançamento SUV
 * Grande produção — carros, locações externas
 * ══════════════════════════════════════════════ */
function project4() {
  const ini = {
    pre: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretor', 'Henrique Bastos', 'dia', 7000, 500, 3),
        labor('DIREÇÃO', '1º Assist. Direção', 'Fernanda Dias', 'dia', 2200, 200, 3),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtor Executivo', 'Sérgio Branco', 'dia', 4500, 0, 4),
        labor('PRODUÇÃO', 'Diretor de Produção', 'Michele Andrade', 'dia', 2800, 200, 4),
        labor('PRODUÇÃO', 'Coord. de Produção', 'Leandro Dias', 'dia', 1800, 0, 3),
      ],
      'FOTOGRAFIA E TÉCNICA': [
        labor('FOTOGRAFIA E TÉCNICA', 'Diretor de Fotografia', 'Alexandre Kim', 'dia', 6000, 500, 2),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretor de Arte', 'Cássio Valentim', 'dia', 3500, 200, 3),
      ],
    },
    prod: {
      'DIREÇÃO': [
        labor('DIREÇÃO', 'Diretor', 'Henrique Bastos', 'dia', 7000, 500, 4),
        labor('DIREÇÃO', '1º Assist. Direção', 'Fernanda Dias', 'dia', 2200, 200, 4),
        labor('DIREÇÃO', '2º Assist. Direção', 'Nicolas Prado', 'dia', 1300, 150, 4),
      ],
      'PRODUÇÃO': [
        labor('PRODUÇÃO', 'Produtor Executivo', 'Sérgio Branco', 'dia', 4500, 0, 4),
        labor('PRODUÇÃO', 'Diretor de Produção', 'Michele Andrade', 'dia', 2800, 200, 4),
        labor('PRODUÇÃO', 'Coord. de Produção', 'Leandro Dias', 'dia', 1800, 0, 4),
        labor('PRODUÇÃO', 'Produtora de Set', 'Natália Rocha', 'dia', 2000, 150, 4),
        labor('PRODUÇÃO', 'Assist. Produção', 'Rafael Neto', 'dia', 800, 0, 4),
        labor('PRODUÇÃO', 'Assist. Produção', 'Bruna Farias', 'dia', 800, 0, 4),
      ],
      'FOTOGRAFIA E TÉCNICA': [
        labor('FOTOGRAFIA E TÉCNICA', 'Diretor de Fotografia', 'Alexandre Kim', 'dia', 6000, 500, 4),
        labor('FOTOGRAFIA E TÉCNICA', '1º Assist. Câmera', 'Thales Correia', 'dia', 1500, 200, 4),
        labor('FOTOGRAFIA E TÉCNICA', '2º Assist. Câmera', 'Bianca Moura', 'dia', 900, 100, 4),
        labor('FOTOGRAFIA E TÉCNICA', 'Op. Steadicam', 'Marcelo Dutra', 'dia', 2800, 300, 2),
        labor('FOTOGRAFIA E TÉCNICA', 'Eletricista Chefe', 'Rogério Alves', 'dia', 1800, 200, 4),
        labor('FOTOGRAFIA E TÉCNICA', 'Eletricista', 'Fábio Torres', 'dia', 1200, 150, 4),
        labor('FOTOGRAFIA E TÉCNICA', 'Maquinista Chefe', 'Cláudio Ramos', 'dia', 1700, 200, 4),
      ],
      'ARTE E CENOGRAFIA': [
        labor('ARTE E CENOGRAFIA', 'Diretor de Arte', 'Cássio Valentim', 'dia', 3500, 200, 4),
        labor('ARTE E CENOGRAFIA', 'Cenógrafa', 'Helena Vasconcelos', 'dia', 2200, 0, 4),
        labor('ARTE E CENOGRAFIA', 'Contra-regra', 'William Santos', 'dia', 1300, 0, 4),
      ],
      'FIGURINO E MAQUIAGEM': [
        labor('FIGURINO E MAQUIAGEM', 'Figurinista', 'Lorena Duarte', 'dia', 2000, 150, 4),
        labor('FIGURINO E MAQUIAGEM', 'Maquiador(a)', 'Cíntia Vieira', 'dia', 1500, 100, 4),
      ],
      'SOM DIRETO': [
        labor('SOM DIRETO', 'Técnico de Som', 'Daniel Campos', 'dia', 2000, 200, 4),
        labor('SOM DIRETO', 'Microfonista', 'Samuel Lira', 'dia', 1100, 100, 4),
      ],
      'CASTING': [
        cost('CASTING', 'Elenco', 'Ator principal', 'cache', 20000, 1),
        cost('CASTING', 'Elenco', 'Atriz coadjuvante', 'cache', 10000, 1),
        cost('CASTING', 'Elenco', 'Figurantes (lote)', 'cache', 600, 8),
      ],
      'EQUIPAMENTOS': [
        cost('EQUIPAMENTOS', 'CineRent SP', 'ARRI Alexa 35 + Kit Completo', 'cache', 10000, 4),
        cost('EQUIPAMENTOS', 'CineRent SP', 'Kit Lentes Panavision', 'cache', 5000, 4),
        cost('EQUIPAMENTOS', 'LuzMaster', 'Kit Iluminação Grande (HMI + LED)', 'cache', 7000, 4),
        cost('EQUIPAMENTOS', 'GripHouse', 'Kit Grip Premium + Technocrane', 'cache', 8000, 4),
        cost('EQUIPAMENTOS', 'Drone Films', 'DJI Inspire 3 + Piloto certificado', 'cache', 5000, 3),
        cost('EQUIPAMENTOS', 'MonitorPro', 'Monitores 4K + Video Village', 'cache', 2500, 4),
      ],
      'LOCAÇÕES': [
        cost('LOCAÇÕES', 'Rodovia SP', 'Interdição parcial rodovia (permissão)', 'cache', 18000, 2),
        cost('LOCAÇÕES', 'Serra da Mantiqueira', 'Locação montanha', 'cache', 8000, 1),
        cost('LOCAÇÕES', 'Estúdio MegaSet', 'Estúdio para detalhes', 'cache', 7000, 1),
      ],
      'TRANSPORTE': [
        cost('TRANSPORTE', 'TransLog', 'Caminhão cegonha (carros)', 'cache', 5000, 2),
        cost('TRANSPORTE', 'TransLog', 'Van produção (4 veículos)', 'cache', 2400, 4),
        cost('TRANSPORTE', 'TransLog', 'Caminhão equipamento', 'cache', 3000, 4),
      ],
      'CATERING': [
        cost('CATERING', 'Chef de Set', 'Almoço premium + 2 coffees (40 pax)', 'cache', 6000, 4),
      ],
      'DESPESAS GERAIS': [
        cost('DESPESAS GERAIS', 'Seguros', 'Seguro equipamento + veículos', 'cache', 8000, 1),
        cost('DESPESAS GERAIS', 'Diversos', 'Comunicação rádio HT', 'cache', 1500, 1),
        cost('DESPESAS GERAIS', 'Diversos', 'Material de set', 'cache', 2000, 1),
      ],
    },
    pos: {
      'FINALIZAÇÃO': [
        labor('FINALIZAÇÃO', 'Editor Sênior', 'Marcelo Viana', 'sem', 7000, 0, 4),
        labor('FINALIZAÇÃO', 'Colorista', 'Ana Clara Fontes', 'dia', 4000, 0, 5),
      ],
      'ANIMAÇÃO': [
        labor('ANIMAÇÃO', 'Motion Designer', 'Pedro Augusto', 'dia', 2500, 0, 6),
        labor('ANIMAÇÃO', 'Animador 3D', 'Caio Guedes', 'dia', 3000, 0, 5),
      ],
      'VFX': [
        labor('VFX', 'Supervisor VFX', 'Renato Bassi', 'dia', 4500, 0, 5),
        labor('VFX', 'Compositor VFX', 'Amanda Torres', 'dia', 3000, 0, 8),
        labor('VFX', 'Compositor VFX', 'Igor Santana', 'dia', 3000, 0, 8),
      ],
      'ÁUDIO': [
        labor('ÁUDIO', 'Sound Designer', 'Márcio Paiva', 'dia', 2500, 0, 5),
        labor('ÁUDIO', 'Mixador', 'Cristina Motta', 'dia', 3000, 0, 3),
        labor('ÁUDIO', 'Compositor Musical', 'Túlio Mendes', 'flat', 12000, 0, 1),
      ],
    },
  }

  const vIni = {
    pre: {
      'PRODUÇÃO': [verba('Locação scouting viagens', 5000), verba('Licenças e permissões', 4000)],
      'ARTE E CENOGRAFIA': [verba('Compra materiais cenário car reveal', 12000)],
    },
    prod: {
      'PRODUÇÃO': [verba('Alimentação extras + segurança rodoviária', 3000)],
      'FOTOGRAFIA E TÉCNICA': [verba('Consumíveis premium (mídias RAW, baterias)', 5000)],
    },
    pos: {},
  }

  const mini = { contingencia: 18000, crt: 8000, bvagencia: 12000 }

  // Final: budget increases (scope creep on automotive)
  const fin = JSON.parse(JSON.stringify(ini))
  // Extra shoot day
  fin.prod['DIREÇÃO'][0].quantity = 5
  fin.prod['FOTOGRAFIA E TÉCNICA'][0].quantity = 5
  // More VFX
  fin.pos['VFX'][1].quantity = 10
  fin.pos['VFX'][2].quantity = 10
  // More animation
  fin.pos['ANIMAÇÃO'][1].quantity = 8
  // More expensive location
  fin.prod['LOCAÇÕES'][0].unitCost = 22000
  // Add helicopter shots!
  fin.prod['EQUIPAMENTOS'].push(cost('EQUIPAMENTOS', 'Heli Cineflex', 'Helicóptero + Cineflex', 'cache', 25000, 1))
  // Extra catering day
  fin.prod['CATERING'][0].quantity = 5

  const vFin = JSON.parse(JSON.stringify(vIni))
  vFin.pre['ARTE E CENOGRAFIA'] = [verba('Compra materiais cenário + car prep', 15000)]
  vFin.prod['PRODUÇÃO'] = [verba('Alimentação extras + segurança', 4500)]

  const miniFin = { contingencia: 22000, crt: 8000, bvagencia: 12000 }

  const closing = []
  for (const [phase, depts] of Object.entries(fin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const r of rows) {
        const isLab = r.type === 'labor'
        closing.push(cLine(dept, phase, r.itemName, r.roleFunction, r.unitType, isLab, false,
          r.unitCost, r.extraCost, r.quantity,
          isLab ? pick([10, 12, 14]) : 8,
          isLab ? pick([0, 0, 20, 30, 50]) : 0,
          isLab ? pick([0, 0, 1, 2, 3]) : 0,
          pick(['pago', 'pago', 'pendente'])
        ))
      }
    }
  }
  for (const [phase, depts] of Object.entries(vFin)) {
    for (const [dept, rows] of Object.entries(depts)) {
      for (const v of rows) {
        closing.push(cLine(dept, phase, v.itemName, '', 'verba', false, true, v.unitCost, 0, v.quantity, 8, 0, 0, pick(['pago', 'pendente'])))
      }
    }
  }
  const expenses = [
    expense('Combustível veículos cena', 'Gasolina carros filmagem', 2800, 'pago'),
    expense('Hospedagem equipe Serra', '10 quartos x 1 noite', 5500, 'pago'),
    expense('Polimento carros', 'Preparação veículos', 1200, 'pago'),
    expense('Kit médico set', 'Paramédico + ambulância', 3000, 'pendente'),
    expense('Alimentação extra filmagem noturna', 'Janta equipe noturna', 2200, 'pago'),
  ]

  return {
    job_id: 'BZ7845',
    nome: 'Auto Motor - Lançamento SUV X7',
    agencia: 'DPZ&T',
    cliente: 'Auto Motor do Brasil',
    duracao: '60',
    duracao_unit: 'segundos',
    status: { initial: 'locked', final: 'locked', closing: 'open' },
    budget_lines_initial: ini,
    verba_lines_initial: vIni,
    mini_tables: mini,
    job_value: 580000,
    tax_rate: 14,
    budget_lines_final: fin,
    verba_lines_final: vFin,
    mini_tables_final: miniFin,
    job_value_final: 580000,
    tax_rate_final: 14,
    notes_initial: { pre: 'Pré extenso com locação scouting', prod: '4 diárias — rodovia, serra, estúdio', pos: 'Pós pesada com VFX e trilha original' },
    notes_final: { pre: '', prod: 'Helicóptero adicionado + diária extra', pos: 'VFX expandido significativamente' },
    closing_lines: [closing, expenses],
  }
}

/* ══════════════════════════════════════════════
 * EXECUTAR SEED
 * ══════════════════════════════════════════════ */
async function main() {
  console.log('🎬 Inserindo 4 projetos de teste...\n')

  const projects = [project1(), project2(), project3(), project4()]

  for (const p of projects) {
    const { data, error } = await supabase.from('projects').insert(p).select('id, nome').single()
    if (error) {
      console.error(`❌ Erro ao inserir "${p.nome}":`, error.message)
    } else {
      console.log(`✅ ${data.nome} (ID: ${data.id})`)
    }
  }

  console.log('\n🎉 Seed concluído! Recarregue a página e use "Abrir" para ver os projetos.')
}

main()
