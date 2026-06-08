import { useState, useMemo, useEffect, useRef, Component } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const APPS_SCRIPT_URL  = import.meta.env.VITE_APPS_SCRIPT_URL  || "";
const GESTAO_GOOGLE_EMAILS = {
  "marcos.luiz@gocase.com":       { nome: "Marcos",      role: "gestao" },
  "jaine.caboclo@gocase.com":     { nome: "Jaine",       role: "gestao" },
  "transportegogroup@gocase.com": { nome: "Transportes", role: "gestao" },
  "joao.conde@gocase.com":        { nome: "Transportes", role: "gestao" },
  "kelly.sousa@gocase.com":       { nome: "Transportes", role: "gestao" },
  "talita.oliveira@gocase.com":   { nome: "Transportes", role: "gestao" },
  "antonio.mendes@gocase.com":    { nome: "Transportes", role: "gestao" },
};

// ─── STATUS ──────────────────────────────────────────────────────────────────

const STATUS_TRANSP = {
  pendente:               { label: "Recebida — em análise",       badge: "badge-blue" },
  contestada:             { label: "Em análise",                  badge: "badge-blue" },
  auditada:               { label: "Em contestação",              badge: "badge-yellow" },
  nao_auditada:           { label: "Em processamento",            badge: "badge-blue" },
  retorno_aceito_total:   { label: "Contestação aceita",          badge: "badge-green" },
  retorno_aceito_parcial: { label: "Contestação aceita parcial",  badge: "badge-green" },
  retorno_recusado:       { label: "Contestação recusada",        badge: "badge-red" },
  solicitada:             { label: "Pagamento solicitado",        badge: "badge-blue" },
  aguardando_aprovacao:   { label: "Pagamento em aprovação",      badge: "badge-yellow" },
  aguardando_pagamento:   { label: "Pagamento aprovado",          badge: "badge-green" },
  paga:                   { label: "Paga",                        badge: "badge-green" },
  paga_com_atraso:        { label: "Paga",                        badge: "badge-green" },
};

const isPaga = f => ["paga","paga_com_atraso","Paga"].includes(f.status);

const getStatusTransp = (f) => {
  const st = (f.status || "pendente").toLowerCase();
  return STATUS_TRANSP[st] || { label: f.status || "Pendente", badge: "badge-amber" };
};

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("Portal error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Barlow',sans-serif"}}>
          <div style={{background:"#161C26",border:"1px solid rgba(248,113,113,0.28)",borderTop:"3px solid #F87171",borderRadius:12,padding:"40px 36px",maxWidth:460,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:19,fontWeight:800,color:"#E2E8F0",marginBottom:8}}>Algo deu errado</div>
            <p style={{fontSize:13,color:"#64748B",lineHeight:1.7,marginBottom:20}}>Ocorreu um erro inesperado. Tente recarregar a página.</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",padding:"10px 28px",background:"#F5A623",color:"#0D1117",border:"none",borderRadius:6,cursor:"pointer"}}>
              Recarregar Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

function lerUsuarioStorage() {
  try { const s=localStorage.getItem("portal_usuario"); if(!s)return null; const u=JSON.parse(s); if(!u||!u.role)return null; return{...u,picture:null}; } catch { try{localStorage.removeItem("portal_usuario");}catch{} return null; }
}
function salvarUsuarioStorage(u) { try{const{picture,...sem}=u;localStorage.setItem("portal_usuario",JSON.stringify(sem));}catch{} }
function limparUsuarioStorage() { try{localStorage.removeItem("portal_usuario");}catch{} }

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const CICLOS_TRANSPORTADORA = {
  "Anjun":"mensal","Correios":"mensal","Diálogo":"mensal","Diaslog":"mensal",
  "Gollog":"quinzena","J&T":"mensal","Log Serviços":"mensal","Logan":"quinzena",
  "Unixlog":"mensal","SR Log":"quinzena","SP Fly":"mensal","KR":"mensal",
  "Jamef":"mensal","Favorita":"demanda","Ativa":"mensal","Bruno Transportes":"mensal",
  "ARC":"demanda","PAED":"demanda","Matheus":"demanda","Binho":"demanda",
  "Family":"mensal","FSL":"demanda","Cia Cargas":"quinzena","Dirceu":"quinzena",
  "Rodo Prime":"quinzena","Teste":"mensal",
};
const OPCOES_CICLO = {
  mensal:["Mensal"],quinzena:["1ª Quinzena","2ª Quinzena"],
  demanda:["Mensal","1ª Quinzena","2ª Quinzena","Semanal"],
  livre:["Mensal","1ª Quinzena","2ª Quinzena","Semanal"],
};
function getCiclosTransp(n){const t=CICLOS_TRANSPORTADORA[n]||"livre";return OPCOES_CICLO[t]||["Mensal","1ª Quinzena","2ª Quinzena"];}

const PRAZO_PAGAMENTO = {
  "Anjun":30,"Correios":21,"Diálogo":30,"Diaslog":15,"Gollog":30,"J&T":30,
  "Log Serviços":30,"Logan":15,"Unixlog":30,"SR Log":15,"SP Fly":30,"KR":21,
  "Jamef":30,"Favorita":30,"Ativa":30,"Bruno Transportes":15,"ARC":30,"PAED":30,
  "Matheus":30,"Binho":15,"Family":20,"FSL":27,"Cia Cargas":30,"Dirceu":15,
  "Rodo Prime":15,"Teste":30,
};
const PRAZO_PADRAO = 30;
const DATAS_PGTO = [10, 20, 30];

const transportadoras=["Anjun","Correios","Diálogo","Diaslog","Gollog","J&T","Log Serviços","Logan","Unixlog","SR Log","SP Fly","KR","Jamef","Favorita","Ativa","Bruno Transportes","ARC","PAED","Matheus","Binho","Family","FSL","Cia Cargas","Dirceu","Rodo Prime","Teste","Outro"];
const empresasGrupo=["Gocase","Ápice","Barbour's","Lescent","Kokeshi","By Sâmia","Rituária","Rituária (Maga)","BeautyHub","Gobeaute"];
const CDs=["CD MG","CD SP","CD ES","CD RJ"];
const meses=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const anos=["2023","2024","2025","2026","2027","2028","2029","2030"];
const motivosDesc=["Extravio/Avaria","Penalidade por SLA","Devolução Indevida de Pedidos","Desconto por Volume","Ajuste Contratual","Contestação de Fatura","Outro"];

// ─── UTILS ───────────────────────────────────────────────────────────────────

const fmtBRL=v=>{try{return`R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}catch{return"R$ 0,00";}};
const fmtDate=s=>{if(!s)return"—";try{const[y,m,d]=s.split("-");return`${d}/${m}/${y}`;}catch{return s;}};
const fmtAviso=v=>{if(!v)return"";try{if(v.includes("T"))return fmtDate(v.split("T")[0]);if(v.includes("-")&&v.length===10)return fmtDate(v);return v;}catch{return v;}};

const diasAteVencer=s=>{if(!s)return 9999;try{const d=Math.ceil((new Date(s)-new Date())/86400000);return isNaN(d)?9999:d;}catch{return 9999;}};

// Extrai mês e ano do campo periodo (YYYY-MM) ou dos campos mes/ano
const getMes = f => {
  if(f.mes) return f.mes;
  if(f.periodo) {
    const mesNum = f.periodo.split("-")[1];
    const map={"01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio","06":"Junho","07":"Julho","08":"Agosto","09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
    return map[mesNum] || "";
  }
  return "";
};
const getAno = f => {
  if(f.ano) return f.ano;
  if(f.periodo) return f.periodo.split("-")[0] || "";
  return "";
};

// ─── CÁLCULO DE DIAS ÚTEIS (sem feriados por ora — feriados vêm do Apps Script) ──

function adicionarDiasUteis(data, dias, feriados=[]) {
  const fSet = new Set(feriados.map(f => typeof f === "string" ? f : f.toISOString?.().split("T")[0]));
  const d = new Date(data); let add = 0;
  while (add < dias) {
    d.setDate(d.getDate()+1);
    const iso = d.toISOString().split("T")[0];
    if(d.getDay()!==0 && d.getDay()!==6 && !fSet.has(iso)) add++;
  }
  return d;
}

function diasUteisAteVencer(s, feriados=[]) {
  if(!s) return 9999;
  try {
    const toLocalISO = d => {
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${dd}`;
    };
    const fSet = new Set(feriados.map(f => typeof f === "string" ? f.substring(0,10) : toLocalISO(f)));
    // Parseia as datas usando componentes locais para evitar problema de fuso
    const partes = s.split("-").map(Number);
    if(partes.length!==3) return 9999;
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    const venc=new Date(partes[0],partes[1]-1,partes[2]); venc.setHours(0,0,0,0);
    if(isNaN(venc.getTime())) return 9999;
    if(venc<hoje) return -1;
    let u=0; const c=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate());
    const vencTime=venc.getTime();
    while(c.getTime()<=vencTime){
      const iso = toLocalISO(c);
      if(c.getDay()!==0 && c.getDay()!==6 && !fSet.has(iso)) u++;
      c.setDate(c.getDate()+1);
    }
    return u;
  } catch { return 9999; }
}

function proximaDataPagamento(base, feriados=[]) {
  const b=new Date(base); b.setHours(0,0,0,0);
  const ano=b.getFullYear(), mes=b.getMonth();
  const cands=[];
  for(let m=0;m<=2;m++){
    const aC=mes+m>11?ano+1:ano, mC=(mes+m)%12;
    for(const dia of DATAS_PGTO){
      const ult=new Date(aC,mC+1,0).getDate();
      const c=new Date(aC,mC,Math.min(dia,ult)); c.setHours(0,0,0,0);
      if(c>=b) cands.push(c);
    }
  }
  cands.sort((a,b2)=>a-b2); return cands[0]||null;
}

function analisarViabilidadePagamento(vencimentoISO, transportadora, ciclo="", feriados=[]) {
  if(!vencimentoISO) return null;
  try {
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    const partes=vencimentoISO.split("-").map(Number);
    if(partes.length!==3||partes.some(isNaN)) return null;
    const [vy,vm,vd]=partes;
    const venc=new Date(vy,vm-1,vd); venc.setHours(0,0,0,0);
    if(isNaN(venc.getTime())) return null;
    const srLogCheck=transportadora==="SR Log"?validarVencimentoSRLog(vencimentoISO,ciclo):null;
    const minUteis=adicionarDiasUteis(hoje,7,feriados);
    const prazo=PRAZO_PAGAMENTO[transportadora]??PRAZO_PADRAO;
    const maxContr=new Date(hoje); maxContr.setDate(maxContr.getDate()+prazo); maxContr.setHours(0,0,0,0);
    const baseCalc=minUteis>maxContr?minUteis:maxContr;
    const proxPgto=proximaDataPagamento(baseCalc,feriados);
    if(!proxPgto) return {viavel:false,dataPagamentoSugerida:null,dataPagamentoStr:null,srLogCheck};
    const viavel=proxPgto<=venc;
    const dtStr=`${String(proxPgto.getDate()).padStart(2,"0")}/${String(proxPgto.getMonth()+1).padStart(2,"0")}/${proxPgto.getFullYear()}`;
    return {viavel,dataPagamentoSugerida:proxPgto,dataPagamentoStr:dtStr,prazoContratual:prazo,baseUsada:minUteis>maxContr?"7du":"contratual",vencimentoAbaixoContrato:venc<maxContr,srLogCheck};
  } catch { return null; }
}

function validarVencimentoSRLog(vencimentoISO, ciclo) {
  if(!vencimentoISO||!ciclo) return null;
  try {
    const [vy,vm,vd]=vencimentoISO.split("-").map(Number);
    if(!vy||!vm||!vd) return null;
    const vencDate=new Date(vy,vm-1,vd); vencDate.setHours(0,0,0,0);
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    const mesRef=hoje.getMonth(), anoRef=hoje.getFullYear();
    const proxMes=mesRef===11?0:mesRef+1, anoProx=mesRef===11?anoRef+1:anoRef;
    let diaEsp, descEsp;
    if(ciclo==="1ª Quinzena"){diaEsp=10;descEsp="dia 10 do mês seguinte";}
    else if(ciclo==="2ª Quinzena"){const ult=new Date(anoProx,proxMes+1,0).getDate();diaEsp=Math.min(30,ult);descEsp="dia 30 do mês seguinte";}
    else return null;
    const dataEsp=new Date(anoProx,proxMes,diaEsp); dataEsp.setHours(0,0,0,0);
    const fmtEsp=`${String(diaEsp).padStart(2,"0")}/${String(proxMes+1).padStart(2,"0")}/${anoProx}`;
    return {correto:vencDate>=dataEsp,abaixoDoAcordado:vencDate<dataEsp,dataEsperadaStr:fmtEsp,descEsperado:descEsp,ciclo};
  } catch { return null; }
}

// ─── ÍCONES ───────────────────────────────────────────────────────────────────

const Icon=({name,size=16,color="currentColor"})=>{
  const icons={
    truck:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    upload:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    chart:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    building:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/></svg>,
    pin:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    shuffle:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>,
    calendar:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    dollar:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    paperclip:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
    file:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
    fileText:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    table:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
    clock:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    alert:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    user:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    lock:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    check:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    x:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    folder:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    logout:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    search:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    arrowRight:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    trash:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    mail:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    google:<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  };
  return icons[name]||null;
};

// ─── CSS ─────────────────────────────────────────────────────────────────────

const css=`
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --amber:#F5A623;--amber-glow:rgba(245,166,35,0.12);--amber-b:rgba(245,166,35,0.28);
  --dark:#0D1117;--s1:#161C26;--s2:#1C2333;--s3:#232D3F;
  --bd:rgba(255,255,255,0.07);--text:#E2E8F0;--muted:#64748B;--dim:#2D3748;
  --red:#F87171;--red-g:rgba(248,113,113,0.1);--red-b:rgba(248,113,113,0.28);
  --green:#4ADE80;--green-g:rgba(74,222,128,0.09);--green-b:rgba(74,222,128,0.28);
  --blue:#60A5FA;--blue-g:rgba(96,165,250,0.09);--blue-b:rgba(96,165,250,0.28);
  --yellow:#FDE047;--yellow-g:rgba(253,224,71,0.09);--yellow-b:rgba(253,224,71,0.28);
  --orange:#FB923C;--orange-g:rgba(251,146,60,0.09);--orange-b:rgba(251,146,60,0.28);
}
body{background:var(--dark);font-family:'Barlow',sans-serif;color:var(--text);}
.bg-grid{background-image:repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.015) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.015) 40px);}
.topbar{background:linear-gradient(180deg,#080B10 0%,var(--dark) 100%);border-bottom:2px solid var(--amber);position:relative;overflow:hidden;}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:48px;background:radial-gradient(ellipse 55% 100% at 50% 100%,rgba(245,166,35,0.08) 0%,transparent 70%);pointer-events:none;}
.topbar-inner{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:14px;}
.topbar-logo{width:40px;height:40px;border-radius:7px;background:var(--amber);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 20px rgba(245,166,35,0.35);}
.topbar-badge{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.13em;text-transform:uppercase;color:var(--amber);background:var(--amber-glow);border:1px solid var(--amber-b);padding:2px 8px;border-radius:3px;display:inline-block;margin-bottom:3px;}
.topbar-title{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;letter-spacing:0.03em;color:var(--text);line-height:1;}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
.topbar-user{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;color:var(--muted);display:flex;align-items:center;gap:7px;}
.topbar-avatar-ph{width:26px;height:26px;border-radius:50%;background:var(--s3);border:1.5px solid var(--bd);display:flex;align-items:center;justify-content:center;}
.btn-logout{display:flex;align-items:center;gap:5px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:5px 11px;border-radius:4px;border:1px solid var(--bd);background:var(--s2);color:var(--muted);cursor:pointer;transition:all .15s;}
.btn-logout:hover{border-color:var(--red-b);color:var(--red);}
.stripe{height:5px;background:repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 32px,transparent 32px,transparent 56px);opacity:.35;}
.tabs-bar{background:var(--s1);border-bottom:1px solid var(--bd);}
.tabs-inner{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;}
.tab{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:13px 20px;cursor:pointer;border:none;background:none;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;display:flex;align-items:center;gap:7px;}
.tab:hover{color:var(--text);}.tab.on{color:var(--amber);border-bottom-color:var(--amber);}
.tab-dot{width:6px;height:6px;border-radius:50%;background:var(--red);animation:pulse 1.8s infinite;flex-shrink:0;}
.page{max-width:1100px;margin:0 auto;padding:26px 24px 60px;}
.page-sm{max-width:740px;margin:0 auto;padding:26px 24px 60px;}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:20px 22px;margin-bottom:12px;position:relative;overflow:hidden;}
.card::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:var(--amber);border-radius:10px 0 0 10px;}
.card-plain{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:20px 22px;margin-bottom:12px;}
.sec-head{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.sec-num{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:var(--dark);background:var(--amber);width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sec-title{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--text);}
.sec-sub{font-size:12px;color:var(--muted);margin-top:1px;}
.sec-ico{margin-left:auto;opacity:0.2;display:flex;align-items:center;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
@media(max-width:700px){.g2,.g3{grid-template-columns:1fr 1fr;}}
@media(max-width:480px){.g2,.g3{grid-template-columns:1fr;}}
.fld{display:flex;flex-direction:column;gap:5px;}
.lbl{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:var(--muted);}
.req{color:var(--amber);margin-left:2px;}
.sel-w{position:relative;}
.sel-w::after{content:'▾';position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--amber);font-size:11px;pointer-events:none;}
select.sel,input.inp{width:100%;padding:9px 11px;font-family:'Barlow',sans-serif;font-size:14px;color:var(--text);background:var(--s2);border:1px solid var(--bd);border-radius:6px;outline:none;appearance:none;transition:border-color .15s,box-shadow .15s;}
select.sel{padding-right:28px;cursor:pointer;}select.sel option{background:var(--s2);}
select.sel:focus,input.inp:focus{border-color:var(--amber);box-shadow:0 0 0 3px rgba(245,166,35,0.09);}
input.inp::placeholder{color:var(--dim);}
.pfx-w{position:relative;}.pfx{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:var(--amber);pointer-events:none;}
.pfx-w input{padding-left:24px;}
.tgl-g{display:flex;gap:6px;flex-wrap:wrap;}
.tgl{padding:7px 15px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:5px;cursor:pointer;border:1.5px solid var(--bd);background:var(--s2);color:var(--muted);transition:all .15s;}
.tgl.on{border-color:var(--amber);background:var(--amber-glow);color:var(--amber);}
.tgl:hover:not(.on){border-color:var(--dim);color:var(--text);}
.disc-box{background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:14px 16px;margin-top:12px;}
.disc-fields{margin-top:12px;padding-top:12px;border-top:1px solid var(--bd);}
.dz{border:1.5px dashed var(--bd);border-radius:8px;padding:28px 18px;text-align:center;cursor:pointer;background:var(--s2);transition:all .2s;}
.dz:hover,.dz.drag{border-color:var(--amber);background:var(--amber-glow);}
.dz-icon{display:flex;justify-content:center;margin-bottom:10px;opacity:0.4;}
.dz:hover .dz-icon,.dz.drag .dz-icon{opacity:0.8;}
.dz-title{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:0.03em;color:var(--text);}
.dz-sub{font-size:12px;color:var(--muted);margin-top:3px;}
.flist{display:flex;flex-direction:column;gap:5px;margin-top:8px;}
.fitem{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:6px;}
.fitem-left{display:flex;align-items:center;gap:8px;}
.fitem-icon{opacity:0.45;display:flex;align-items:center;flex-shrink:0;}
.fname{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;color:var(--text);}
.ftag{font-size:9px;font-weight:800;letter-spacing:0.1em;color:var(--dark);background:var(--amber);padding:1px 5px;border-radius:2px;margin-left:6px;font-family:'Barlow Condensed',sans-serif;}
.fsize{font-size:11px;color:var(--muted);}
.frm{background:none;border:none;cursor:pointer;color:var(--dim);display:flex;align-items:center;padding:4px;border-radius:3px;transition:color .15s;}
.frm:hover{color:var(--red);}
.prev{background:var(--s2);border:1px solid var(--amber-b);border-radius:8px;padding:14px 18px;}
.prev-lbl{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--amber);margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.prev-row{margin-bottom:7px;display:flex;align-items:flex-start;gap:8px;}
.prev-row-icon{opacity:0.35;flex-shrink:0;margin-top:1px;}
.prev-k{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:1px;}
.prev-v{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:600;color:var(--amber);word-break:break-all;letter-spacing:0.02em;}
.sub-area{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap;}
.sub-status{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px;}
.sub-status.ok{color:var(--green);}
.btn{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:10px 28px;border-radius:6px;border:none;cursor:pointer;min-width:160px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;}
.btn.on{background:var(--amber);color:var(--dark);box-shadow:0 0 18px rgba(245,166,35,0.3);}
.btn.on:hover{background:#FBBF24;box-shadow:0 0 28px rgba(245,166,35,0.45);transform:translateY(-1px);}
.btn.off{background:var(--s3);color:var(--dim);cursor:not-allowed;}
.btn-clear{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:10px 18px;border-radius:6px;border:1px solid var(--bd);background:none;color:var(--muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:7px;}
.btn-clear:hover{border-color:var(--red-b);color:var(--red);}
.spage{min-height:60vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.scard{background:var(--s1);border:1px solid var(--bd);border-top:3px solid var(--amber);border-radius:12px;padding:40px 36px;max-width:420px;width:100%;text-align:center;}
.sico{width:52px;height:52px;border-radius:50%;background:var(--amber-glow);border:1.5px solid var(--amber-b);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;}
.stitle{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:var(--text);margin-bottom:6px;}
.ssub{font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:18px;}
.btn-r{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:10px 26px;background:var(--amber);color:var(--dark);border:none;border-radius:6px;cursor:pointer;margin-top:14px;transition:background .15s;display:inline-flex;align-items:center;gap:7px;}
.btn-r:hover{background:#FBBF24;}
.login-card{background:var(--s1);border:1px solid var(--bd);border-top:3px solid var(--amber);border-radius:12px;padding:28px 28px 24px;max-width:380px;width:100%;}
.login-mode-sw{display:flex;gap:0;margin-bottom:20px;background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:3px;}
.login-mode-btn{flex:1;padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:none;background:none;color:var(--muted);border-radius:6px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:5px;}
.login-mode-btn.on{background:var(--s3);color:var(--amber);box-shadow:0 1px 4px rgba(0,0,0,0.3);}
.google-btn-wrap{display:flex;justify-content:center;min-height:44px;align-items:center;margin:12px 0;}
.divider-or{display:flex;align-items:center;gap:10px;margin:14px 0 12px;color:var(--dim);font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;}
.divider-or::before,.divider-or::after{content:'';flex:1;height:1px;background:var(--bd);}
.login-fields{display:flex;flex-direction:column;gap:12px;margin-bottom:16px;}
.login-err{background:var(--red-g);border:1px solid var(--red-b);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--red);text-align:center;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:6px;}
.btn-login{width:100%;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:11px;background:var(--amber);color:var(--dark);border:none;border-radius:6px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;}
.btn-login:hover{background:#FBBF24;box-shadow:0 0 22px rgba(245,166,35,0.35);}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;}
@media(max-width:700px){.kpi-grid{grid-template-columns:1fr 1fr;}}
.kpi{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:16px 18px;position:relative;overflow:hidden;}
.kpi::before{content:'';position:absolute;top:0;left:0;width:100%;height:2px;}
.kpi.k-amber::before{background:var(--amber);}.kpi.k-red::before{background:var(--red);}
.kpi.k-green::before{background:var(--green);}.kpi.k-blue::before{background:var(--blue);}
.kpi-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.kpi-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);}
.kpi-icon{opacity:0.2;}
.kpi-value{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;letter-spacing:0.01em;line-height:1;}
.kpi.k-amber .kpi-value{color:var(--amber);}.kpi.k-red .kpi-value{color:var(--red);}
.kpi.k-green .kpi-value{color:var(--green);}.kpi.k-blue .kpi-value{color:var(--blue);}
.kpi-sub{font-size:11px;color:var(--muted);margin-top:3px;}
.tbl-wrap{overflow-x:auto;border-radius:8px;border:1px solid var(--bd);}
table.tbl{width:100%;border-collapse:collapse;font-size:13px;}
.tbl th{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);padding:10px 14px;background:var(--s2);text-align:left;border-bottom:1px solid var(--bd);white-space:nowrap;}
.tbl td{padding:11px 14px;border-bottom:1px solid var(--bd);color:var(--text);vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}.tbl tr:hover td{background:rgba(255,255,255,0.02);}
.badge{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:2px 7px;border-radius:3px;}
.badge-red{background:var(--red-g);color:var(--red);border:1px solid var(--red-b);}
.badge-yellow{background:var(--yellow-g);color:var(--yellow);border:1px solid var(--yellow-b);}
.badge-green{background:var(--green-g);color:var(--green);border:1px solid var(--green-b);}
.badge-blue{background:var(--blue-g);color:var(--blue);border:1px solid var(--blue-b);}
.badge-amber{background:var(--amber-glow);color:var(--amber);border:1px solid var(--amber-b);}
.badge-orange{background:var(--orange-g);color:var(--orange);border:1px solid var(--orange-b);}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center;}
.filter-inp{padding:7px 10px;font-family:'Barlow',sans-serif;font-size:13px;color:var(--text);background:var(--s2);border:1px solid var(--bd);border-radius:6px;outline:none;transition:border-color .15s;}
.filter-inp:focus{border-color:var(--amber);}.filter-inp::placeholder{color:var(--dim);}
select.filter-inp{appearance:none;padding-right:22px;cursor:pointer;}
.filter-clear{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:7px 12px;background:none;border:1px solid var(--bd);border-radius:6px;color:var(--muted);cursor:pointer;transition:all .15s;}
.filter-clear:hover{border-color:var(--amber-b);color:var(--amber);}
.results-count{font-size:12px;color:var(--muted);margin-left:auto;}
.hist-item{background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:13px 15px;margin-bottom:7px;display:flex;align-items:center;gap:13px;transition:border-color .15s;}
.hist-item:hover{border-color:var(--amber-b);}
.hist-icon{flex-shrink:0;opacity:0.35;}
.hist-name{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--text);}
.hist-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.hist-right{margin-left:auto;text-align:right;flex-shrink:0;}
.hist-val{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:var(--amber);}
.hist-date{font-size:11px;color:var(--muted);margin-top:2px;}
.bar-chart{display:flex;flex-direction:column;gap:9px;}
.bar-row{display:flex;align-items:center;gap:10px;}
.bar-label{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:600;color:var(--muted);width:110px;flex-shrink:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bar-track{flex:1;background:var(--s3);border-radius:2px;height:12px;overflow:hidden;}
.bar-fill{height:100%;border-radius:2px;background:var(--amber);transition:width .7s cubic-bezier(.4,0,.2,1);}
.bar-amt{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:var(--text);width:88px;text-align:right;flex-shrink:0;}
.sub-tabs{display:flex;gap:0;margin-bottom:18px;border-bottom:1px solid var(--bd);}
.sub-tab{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;padding:9px 16px;cursor:pointer;border:none;background:none;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;display:flex;align-items:center;gap:6px;}
.sub-tab:hover{color:var(--text);}.sub-tab.on{color:var(--amber);border-bottom-color:var(--amber);}
.footer{text-align:center;margin-top:14px;font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.fade-in{animation:fadeIn .3s ease both;}
.page,.page-sm{animation:fadeIn .25s ease both;}
`;

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────

function Sel({value,onChange,options,placeholder}){return<div className="sel-w"><select className="sel" value={value} onChange={e=>onChange(e.target.value)}><option value="">{placeholder}</option>{options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select></div>;}
function Inp({value,onChange,type="text",placeholder,prefix}){return prefix?<div className="pfx-w"><span className="pfx">{prefix}</span><input className="inp" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>:<input className="inp" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>;}
function Tgl({value,onChange,options}){return<div className="tgl-g">{options.map(o=><button key={o} className={`tgl${value===o?" on":""}`} onClick={()=>onChange(o)}>{o}</button>)}</div>;}
function Field({label,req,children}){return<div className="fld"><label className="lbl">{label}{req&&<span className="req">*</span>}</label>{children}</div>;}
function Sec({num,iconName,title,sub,children}){return<div className="card"><div className="sec-head"><div className="sec-num">{num}</div><div><div className="sec-title">{title}</div>{sub&&<div className="sec-sub">{sub}</div>}</div>{iconName&&<div className="sec-ico"><Icon name={iconName} size={18}/></div>}</div>{children}</div>;}

function Dropzone({files,onChange}){
  const inputId=useRef(`fi-${Math.random().toString(36).slice(2)}`);
  const [drag,setDrag]=useState(false);
  const fmt=b=>b<1024?b+" B":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";
  const add=fl=>onChange([...files,...Array.from(fl)]);
  return<div>
    <div className={`dz${drag?" drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);add(e.dataTransfer.files)}} onClick={()=>document.getElementById(inputId.current)?.click()}>
      <div className="dz-icon"><Icon name="upload" size={28} color="var(--amber)"/></div>
      <div className="dz-title">Arraste ou clique para anexar</div>
      <div className="dz-sub">PDF · XML · XLSX — fatura principal e documentos auxiliares</div>
      <input id={inputId.current} type="file" multiple accept=".pdf,.xml,.xlsx,.xls,.png,.jpg" style={{display:"none"}} onChange={e=>add(e.target.files)}/>
    </div>
    {files.length>0&&<div className="flist">{files.map((f,i)=><div className="fitem" key={i}><div className="fitem-left"><div className="fitem-icon"><Icon name={f.name.endsWith(".pdf")?"fileText":"file"} size={15} color="var(--amber)"/></div><div><div className="fname">{f.name}{i===0&&<span className="ftag">PRINCIPAL</span>}</div><div className="fsize">{fmt(f.size)}</div></div></div><button className="frm" onClick={e=>{e.stopPropagation();onChange(files.filter((_,j)=>j!==i))}}><Icon name="x" size={15}/></button></div>)}</div>}
  </div>;
}

function Preview({d}){
  const nt=d.transportadora==="Outro"?(d.transportadoraOutro||"—"):(d.transportadora||"—");
  const path=`Financeiro / ${d.segmentacao||"—"} / ${d.marca||"—"} / ${nt} / ${d.cdOrigem||"—"} / ${d.ano||"—"} / ${d.mes||"—"} / ${d.ciclo||"—"}`;
  const venc=d.vencimento?d.vencimento.replace(/-/g,""):"DDMMAAAA";
  const file=`${d.numeroFatura||"NF"}_${venc}_${(d.natureza||"TIPO").toUpperCase()}_${nt.replace(/\s/g,"_").toUpperCase()}.pdf`;
  return<div className="prev"><div className="prev-lbl"><Icon name="folder" size={12} color="var(--amber)"/> Pré-visualização · Drive</div><div className="prev-row"><div className="prev-row-icon"><Icon name="folder" size={12}/></div><div><div className="prev-k">Pasta</div><div className="prev-v">{path}</div></div></div><div className="prev-row"><div className="prev-row-icon"><Icon name="file" size={12}/></div><div><div className="prev-k">Arquivo</div><div className="prev-v">{file}</div></div></div></div>;
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({f, feriados=[]}) {
  const paga = isPaga(f);
  if (paga) return <span className="badge badge-green">Paga</span>;
  if (!f.vencimento) return <span className="badge badge-blue">—</span>;
  const dc = diasAteVencer(f.vencimento);
  const du = diasUteisAteVencer(f.vencimento, feriados);
  if (dc < 0) return <span className="badge badge-red">Vencido</span>;
  if (du <= 6) return <span className="badge badge-yellow">Urgente · {du}du</span>;
  return <span className="badge badge-green">A vencer</span>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginInicial({onLogin}){
  const [modo,setModo]=useState("gestao");
  const [user,setUser]=useState("");const [pass,setPass]=useState("");
  const [showPass,setShowPass]=useState(false);
  const [err,setErr]=useState("");const [loadingLogin,setLoadingLogin]=useState(false);
  const googleBtnRef=useRef(null);const gsiInit=useRef(false);
  const decodeJWT=t=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));}catch{return null;}};
  const handleGoogle=res=>{try{const p=decodeJWT(res.credential);if(!p?.email){setErr("Falha na autenticação Google.");return;}const cfg=GESTAO_GOOGLE_EMAILS[p.email.toLowerCase()];if(cfg){setErr("");onLogin({...cfg,email:p.email,picture:null,loginMethod:"google"});}else setErr(`E-mail ${p.email} não autorizado.`);}catch{setErr("Erro na autenticação Google.");}};
  const renderBtn=()=>{if(!window.google?.accounts?.id||!googleBtnRef.current)return;googleBtnRef.current.innerHTML="";window.google.accounts.id.renderButton(googleBtnRef.current,{theme:"filled_black",size:"large",text:"signin_with",width:300,shape:"rectangular"});};
  const initGSI=()=>{if(!window.google?.accounts?.id)return;if(!gsiInit.current){window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleGoogle,ux_mode:"popup"});gsiInit.current=true;}renderBtn();};
  const clientIdOk=GOOGLE_CLIENT_ID&&!GOOGLE_CLIENT_ID.includes("COLE");
  useEffect(()=>{if(modo!=="gestao"||!clientIdOk)return;if(window.google?.accounts?.id){initGSI();}else{const ex=document.getElementById("gsi-script");if(!ex){const s=document.createElement("script");s.id="gsi-script";s.src="https://accounts.google.com/gsi/client";s.async=true;s.onload=initGSI;document.head.appendChild(s);}else{const p=setInterval(()=>{if(window.google?.accounts?.id){clearInterval(p);initGSI();}},150);return()=>clearInterval(p);}}},[modo,clientIdOk]);
  useEffect(()=>{if(modo==="gestao"&&googleBtnRef.current&&window.google?.accounts?.id)renderBtn();});
  const tentarSenha=async()=>{if(loadingLogin)return;setLoadingLogin(true);setErr("");try{const role=modo==="gestao"?"gestao":"transportadora";const res=await fetch(APPS_SCRIPT_URL,{method:"POST",body:JSON.stringify({acao:"autenticar",usuario:user,senha:pass,role})});const text=await res.text();let data;try{data=JSON.parse(text);}catch{throw new Error("Resposta inválida");}if(data.sucesso){onLogin({...data,picture:null,loginMethod:"password"});}else{setErr(data.erro||"Credenciais inválidas.");}}catch(e){setErr("Erro de conexão. Tente novamente.");}finally{setLoadingLogin(false);}};
  return<div className="bg-grid" style={{minHeight:"100vh",background:"var(--dark)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{width:"100%",maxWidth:400}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:54,height:54,borderRadius:10,background:"var(--amber)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 15px",boxShadow:"0 0 30px rgba(245,166,35,0.45)"}}><Icon name="truck" size={27} color="var(--dark)"/></div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:"0.13em",textTransform:"uppercase",color:"var(--amber)",background:"var(--amber-glow)",border:"1px solid var(--amber-b)",padding:"2px 10px",borderRadius:3,display:"inline-block",marginBottom:9}}>Transportes · Financeiro</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:25,fontWeight:800,color:"var(--text)",letterSpacing:"0.02em"}}>Portal de Faturas</div>
      </div>
      <div className="login-card">
        <div className="login-mode-sw">
          <button className={`login-mode-btn${modo==="gestao"?" on":""}`} onClick={()=>{setModo("gestao");setErr("");setUser("");setPass("");}}><Icon name="chart" size={11}/> Gestão</button>
          <button className={`login-mode-btn${modo==="transp"?" on":""}`} onClick={()=>{setModo("transp");setErr("");setUser("");setPass("");}}><Icon name="truck" size={11}/> Transportadora</button>
        </div>
        {err&&<div className="login-err"><Icon name="alert" size={13} color="var(--red)"/>{err}</div>}
        {modo==="gestao"&&<>
          {clientIdOk&&<><div style={{fontSize:12,color:"var(--muted)",textAlign:"center",marginBottom:4}}>Acesse com sua conta Google corporativa</div><div className="google-btn-wrap" ref={googleBtnRef}/><div className="divider-or">ou senha</div></>}
          <div className="login-fields">
            <div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.35,display:"flex"}}><Icon name="user" size={14}/></span><input className="inp" style={{paddingLeft:30}} value={user} onChange={e=>setUser(e.target.value)} placeholder="usuário" onKeyDown={e=>e.key==="Enter"&&tentarSenha()}/></div>
            <div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.35,display:"flex"}}><Icon name="lock" size={14}/></span><input className="inp" type={showPass?"text":"password"} style={{paddingLeft:30,paddingRight:34}} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&tentarSenha()}/><button type="button" onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",opacity:0.4,display:"flex",padding:2}}><Icon name={showPass?"x":"check"} size={14}/></button></div>
          </div>
          <button className="btn-login" onClick={tentarSenha} disabled={loadingLogin}>{loadingLogin?"Entrando...":"Entrar"}<Icon name="arrowRight" size={14} color="var(--dark)"/></button>
        </>}
        {modo==="transp"&&<>
          <div style={{fontSize:12,color:"var(--muted)",textAlign:"center",marginBottom:18}}>Acesse com suas credenciais de transportadora</div>
          <div className="login-fields">
            <div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.35,display:"flex"}}><Icon name="user" size={14}/></span><input className="inp" style={{paddingLeft:30}} value={user} onChange={e=>setUser(e.target.value)} placeholder="seu.usuario" onKeyDown={e=>e.key==="Enter"&&tentarSenha()}/></div>
            <div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.35,display:"flex"}}><Icon name="lock" size={14}/></span><input className="inp" type={showPass?"text":"password"} style={{paddingLeft:30}} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&tentarSenha()}/></div>
          </div>
          <button className="btn-login" onClick={tentarSenha} disabled={loadingLogin}>{loadingLogin?"Entrando...":"Entrar"}<Icon name="arrowRight" size={14} color="var(--dark)"/></button>
        </>}
      </div>
      <div style={{textAlign:"center",marginTop:16,fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--dim)"}}>Portal Interno · Google Drive Corporativo</div>
    </div>
  </div>;
}

// ─── PORTAL ENVIO ─────────────────────────────────────────────────────────────

function PortalEnvio({onNovaFatura,transportadoraFixa,feriados=[]}){
  const getBlank=()=>{const transp=transportadoraFixa||"";const ciclos=getCiclosTransp(transp);return{numeroFatura:"",transportadora:transp,transportadoraOutro:"",marca:"",cnpjEmpresa:"",cnpjEmpresaOutro:"",cdOrigem:"",segmentacao:"",mes:"",ano:"",ciclo:ciclos.length===1?ciclos[0]:"",natureza:"",naturezaOutro:"",vencimento:"",valorBruto:"",possuiDesconto:"",valorDesconto:"",motivoDesconto:"",motivoOutro:"",files:[]};};
  const [f,setF]=useState(getBlank);
  const [done,setDone]=useState(false);const [loading,setLoading]=useState(false);const [protocolo,setProtocolo]=useState("");
  const s=k=>v=>setF(p=>({...p,[k]:v}));
  const fmtCur=v=>{const n=v.replace(/\D/g,"");if(!n)return"";return(parseFloat(n)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});};
  const resetForm=()=>{setF(getBlank());setDone(false);setLoading(false);setProtocolo("");};
  const nomeTranspAtual=f.transportadora==="Outro"?f.transportadoraOutro:f.transportadora;
  const ciclosDisponiveis=getCiclosTransp(nomeTranspAtual);
  const prevTranspRef=useRef(nomeTranspAtual);
  useEffect(()=>{if(!nomeTranspAtual)return;if(prevTranspRef.current===nomeTranspAtual)return;prevTranspRef.current=nomeTranspAtual;if(ciclosDisponiveis.length===1)s("ciclo")(ciclosDisponiveis[0]);else s("ciclo")("");},[nomeTranspAtual]);
  const gerarProtocoloLocal=(transp,numeroFatura,vencimento)=>{const tr=(transp||"XX").substring(0,3).toUpperCase();const nf=(numeroFatura||"").replace(/[^a-zA-Z0-9]/g,"").substring(0,6).toUpperCase();const venc=(vencimento||"").replace(/-/g,"").substring(2);return`FAT-${tr}-${nf}-${venc}`;};
  const analiseVencimento=useMemo(()=>{if(!f.vencimento||f.vencimento.length<10)return null;try{return analisarViabilidadePagamento(f.vencimento,nomeTranspAtual,f.ciclo,feriados);}catch{return null;}},[f.vencimento,nomeTranspAtual,f.ciclo,feriados]);
  const valid=()=>{const nt=f.transportadora==="Outro"?f.transportadoraOutro:f.transportadora;const naturezaOk=f.natureza==="Outro"?!!f.naturezaOutro:!!f.natureza;const cnpjFinal=f.cnpjEmpresa==="Outro"?(f.cnpjEmpresaOutro||""):f.cnpjEmpresa;const cnpjOk=cnpjFinal.replace(/\D/g,"").length===14;const base=f.numeroFatura&&nt&&f.marca&&cnpjOk&&f.cdOrigem&&f.segmentacao&&f.mes&&f.ano&&f.ciclo&&naturezaOk&&f.vencimento&&f.valorBruto&&f.possuiDesconto&&f.files.length>0;const motivoOk=f.motivoDesconto==="Outro"?!!f.motivoOutro:!!f.motivoDesconto;return f.possuiDesconto==="Sim"?!!(base&&f.valorDesconto&&motivoOk):!!base;};
  const totalArquivosMB=f.files.reduce((s,file)=>s+file.size,0)/1048576;
  const submit=async()=>{
    if(!valid())return;
    if(totalArquivosMB>35){alert(`Total de arquivos (${totalArquivosMB.toFixed(1)} MB) excede 35 MB.`);return;}
    setLoading(true);
    try{
      const arquivosBase64=[];
      for(const file of f.files){
        const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({nomeOriginal:file.name,mimeType:file.type||"application/octet-stream",tamanhoBytes:file.size,conteudoBase64:r.result.split(",")[1]});r.onerror=rej;r.readAsDataURL(file);});
        arquivosBase64.push(b64);
      }
      const nt=f.transportadora==="Outro"?f.transportadoraOutro:f.transportadora;
      const proto=gerarProtocoloLocal(nt,f.numeroFatura,f.vencimento);setProtocolo(proto);
      const analise=analisarViabilidadePagamento(f.vencimento,nt,f.ciclo,feriados);
      const avisoVenc=analise?.viavel===false?analise.dataPagamentoStr:null;
      const prazoContratual=PRAZO_PAGAMENTO[nt]??PRAZO_PADRAO;
      const hoje=new Date();hoje.setHours(0,0,0,0);
      const dataMinContratual=new Date(hoje);dataMinContratual.setDate(dataMinContratual.getDate()+prazoContratual);
      const[vy,vm,vd]=f.vencimento.split("-").map(Number);
      const vencDate=new Date(vy,vm-1,vd);vencDate.setHours(0,0,0,0);
      const vencimentoAbaixoContrato=vencDate<dataMinContratual;
      const dataMinVencStr=`${String(dataMinContratual.getDate()).padStart(2,"0")}/${String(dataMinContratual.getMonth()+1).padStart(2,"0")}/${dataMinContratual.getFullYear()}`;
      const srLogCheck=nt==="SR Log"?validarVencimentoSRLog(f.vencimento,f.ciclo):null;
      const srLogVencInvalido=srLogCheck?.abaixoDoAcordado||false;
      const srLogDataEsperada=srLogVencInvalido?(srLogCheck.dataEsperadaStr||""):"";
      const cnpjFinal=f.cnpjEmpresa==="Outro"?(f.cnpjEmpresaOutro||""):f.cnpjEmpresa;
      const payload={protocolo:proto,emissor:{numeroFatura:f.numeroFatura,transportadora:nt,marca:f.marca,cnpjEmpresa:cnpjFinal},origem:{cdOrigem:f.cdOrigem},segmentacao:f.segmentacao,periodo:{mes:f.mes,ano:f.ano,ciclo:f.ciclo},financeiro:{natureza:f.natureza==="Outro"?(f.naturezaOutro||"Outro"):f.natureza,vencimento:f.vencimento,valorBruto:f.valorBruto},descontos:{possuiDesconto:f.possuiDesconto,valorDesconto:f.valorDesconto||null,motivoDesconto:f.motivoDesconto==="Outro"?(f.motivoOutro||"Outro"):(f.motivoDesconto||null)},arquivos:arquivosBase64,avisoVencimento:avisoVenc,vencimentoAbaixoContrato,exibirAvisoContratual:!!(vencimentoAbaixoContrato&&PRAZO_PAGAMENTO[nt]),prazoContratual,dataMinVencimento:dataMinVencStr,srLogVencInvalido,srLogDataEsperada};
      await fetch(APPS_SCRIPT_URL,{method:"POST",mode:"no-cors",body:JSON.stringify(payload)});
      const naturezaFinal=f.natureza==="Outro"?(f.naturezaOutro||"Outro"):f.natureza;
      const nova={id:Date.now(),protocolo:proto,numeroFatura:f.numeroFatura,transportadora:nt,empresa:f.marca,cd:f.cdOrigem,seg:f.segmentacao,natureza:naturezaFinal,vencimento:f.vencimento,valor:parseFloat(f.valorBruto.replace(/\./g,"").replace(",","."))||0,desconto:f.possuiDesconto==="Sim"?(parseFloat(f.valorDesconto.replace(/\./g,"").replace(",","."))||0):0,ciclo:f.ciclo,mes:f.mes,ano:f.ano,status:"pendente",dataPagamento:"",avisoVencimento:avisoVenc,dataEnvio:new Date().toISOString().split("T")[0]};
      onNovaFatura(nova);setLoading(false);setDone(true);
    }catch(err){setLoading(false);alert("Erro ao enviar: "+(err?.message||"Tente novamente."));}
  };
  if(done){
    return<div className="spage"><div className="scard">
      <div className="sico"><Icon name="check" size={24} color="var(--amber)"/></div>
      <div className="stitle">Fatura Registrada</div>
      <p className="ssub">{transportadoraFixa?"Sua fatura foi recebida e está sendo processada.":"Arquivos salvos no Google Drive e registrados no sistema."}</p>
      <div style={{background:"var(--s2)",border:"1px solid var(--amber-b)",borderRadius:8,padding:16,marginBottom:12,textAlign:"center"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Protocolo de Registro</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:"var(--amber)",letterSpacing:"0.05em"}}>{protocolo}</div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:6}}>Guarde este número para acompanhamento</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center",fontSize:12,color:"var(--green)",marginBottom:14}}><Icon name="mail" size={13} color="var(--green)"/>Notificação enviada à equipe de gestão</div>
      {!transportadoraFixa&&<Preview d={f}/>}
      <button className="btn-r" onClick={resetForm}>Nova Fatura <Icon name="arrowRight" size={13} color="var(--dark)"/></button>
    </div></div>;
  }
  return<div className="page-sm">
    <Sec num="1" iconName="building" title="Emissor" sub="Transportadora e empresa do grupo">
      <div className="g2" style={{marginBottom:12}}>
        <Field label="Transportadora" req>{transportadoraFixa?<div style={{padding:"9px 11px",background:"var(--s3)",border:"1px solid var(--bd)",borderRadius:6,fontSize:14,color:"var(--text)",fontWeight:600,display:"flex",alignItems:"center",gap:8}}><Icon name="lock" size={13} color="var(--amber)"/>{transportadoraFixa}</div>:<Sel value={f.transportadora} onChange={v=>{s("transportadora")(v);s("transportadoraOutro")("");}} options={transportadoras} placeholder="Selecione..."/>}</Field>
        <Field label="Empresa do Grupo" req><Sel value={f.marca} onChange={s("marca")} options={empresasGrupo} placeholder="Selecione..."/></Field>
      </div>
      <div style={{marginBottom:12}}><Field label="CNPJ Empresa" req>
        <div className="sel-w"><select className="sel" value={f.cnpjEmpresa||""} onChange={v=>{s("cnpjEmpresa")(v.target.value);s("cnpjEmpresaOutro")("");}}>
          <option value="">Selecione o CNPJ...</option>
          <optgroup label="Lescent"><option value="57.344.563/0002-03">57.344.563/0002-03 — LESCENT VAREJO LTDA (ES)</option><option value="57.344.563/0001-14">57.344.563/0001-14 — LESCENT VAREJO LTDA (SP)</option></optgroup>
          <optgroup label="Ápice"><option value="48.290.289/0003-19">48.290.289/0003-19 — AP COSMETICS LTDA (SP)</option><option value="48.290.289/0002-38">48.290.289/0002-38 — AP COSMETICS LTDA (RJ)</option><option value="48.290.289/0001-57">48.290.289/0001-57 — AP COSMETICS LTDA (ES)</option><option value="26.301.600/0001-83">26.301.600/0001-83 — APICE COSMETICS SA (ES)</option><option value="26.301.600/0002-64">26.301.600/0002-64 — APICE COSMETICS SA (RJ)</option><option value="26.301.600/0003-45">26.301.600/0003-45 — APICE COSMETICS SA (SP)</option></optgroup>
          <optgroup label="Barbour's">
            <option value="54.137.817/0002-16">54.137.817/0002-16 — BB VAREJO LTDA (SP)</option>
            <option value="54.137.817/0004-88">54.137.817/0004-88 — BB VAREJO LTDA (RJ)</option>
            <option value="54.137.817/0003-05">54.137.817/0003-05 — BB VAREJO LTDA (ES)</option>
            <option value="54.137.817/0001-35">54.137.817/0001-35 — BB VAREJO LTDA (MATRIZ SP)</option>
            <option value="54.190.174/0001-93">54.190.174/0001-93 — BB ATACADO LTDA (SP)</option>
            <option value="54.190.174/0003-55">54.190.174/0003-55 — BB ATACADO LTDA (SP)</option>
          </optgroup>
          <optgroup label="Gocase">
            <option value="22.165.464/0001-90">22.165.464/0001-90 — GO COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (CE)</option>
            <option value="22.165.464/0002-71">22.165.464/0002-71 — GO COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (MG)</option>
            <option value="22.165.464/0003-52">22.165.464/0003-52 — GO COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (MG)</option>
            <option value="22.165.464/0004-33">22.165.464/0004-33 — GO COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (SP)</option>
            <option value="23.860.650/0001-02">23.860.650/0001-02 — GOB COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS EIRELI (CE)</option>
            <option value="23.860.650/0005-36">23.860.650/0005-36 — GOB COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA</option>
            <option value="36.838.707/0001-19">36.838.707/0001-19 — BB INDUSTRIA E COMERCIO DE ARTIGOS DE USO PESSOAL LTDA (MG)</option>
            <option value="36.838.707/0002-08">36.838.707/0002-08 — BB INDUSTRIA E COMERCIO DE ARTIGOS DE USO PESSOAL LTDA (MG)</option>
            <option value="36.838.707/0005-42">36.838.707/0005-42 — BB INDUSTRIA E COMERCIO DE ARTIGOS DE USO PESSOAL LTDA (ES)</option>
            <option value="46.537.034/0001-10">46.537.034/0001-10 — GR COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (SP)</option>
            <option value="46.537.034/0002-00">46.537.034/0002-00 — GR COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA</option>
            <option value="46.743.270/0001-93">46.743.270/0001-93 — GP COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (SP)</option>
            <option value="46.743.270/0002-74">46.743.270/0002-74 — GP COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA</option>
            <option value="46.743.270/0003-55">46.743.270/0003-55 — GP COMERCIO DE ARTIGOS ELETRONICOS E ACESSORIOS LTDA (DF)</option>
          </optgroup>
          <optgroup label="BeautyHub">
            <option value="60.453.162/0001-07">60.453.162/0001-07 — BEAUTY HUB VAREJO LTDA (ES)</option>
            <option value="60.453.162/0002-98">60.453.162/0002-98 — BEAUTY HUB VAREJO LTDA (SP)</option>
            <option value="60.453.162/0003-79">60.453.162/0003-79 — BEAUTY HUB VAREJO LTDA (RJ)</option>
            <option value="60.453.002/0001-68">60.453.002/0001-68 — BEAUTY HUB ATACADO LTDA (ES)</option>
            <option value="60.453.002/0002-49">60.453.002/0002-49 — BEAUTY HUB ATACADO LTDA (SP)</option>
            <option value="60.453.002/0003-20">60.453.002/0003-20 — BEAUTY HUB ATACADO LTDA (RJ)</option>
          </optgroup>
          <optgroup label="Gobeaute">
            <option value="57.168.111/0001-29">57.168.111/0001-29 — BEAUTE PARTICIPACOES LTDA</option>
          </optgroup>
          <optgroup label="Kokeshi">
            <option value="58.181.480/0001-14">58.181.480/0001-14 — KOKESHI VAREJO LTDA</option>
            <option value="58.319.197/0001-06">58.319.197/0001-06 — KOKESHI HOLDING S.A.</option>
          </optgroup>
          <optgroup label="Rituária">
            <option value="58.323.315/0001-50">58.323.315/0001-50 — RITU PARTNERS LTDA</option>
            <option value="38.246.589/0001-85">38.246.589/0001-85 — MAGA COMERCIO DE PRODUTOS COSMETICOS S.A.</option>
            <option value="38.246.589/0002-66">38.246.589/0002-66 — MAGA COMERCIO DE PRODUTOS COSMETICOS S.A. (MG)</option>
          </optgroup>
          <option value="Outro">Outro (digitar manualmente)</option>
        </select></div>
        {f.cnpjEmpresa==="Outro"&&<div style={{marginTop:8}}><Inp value={f.cnpjEmpresaOutro||""} onChange={v=>{const n=v.replace(/\D/g,"").slice(0,14);const m=n.length<=2?n:n.length<=5?n.replace(/(\d{2})(\d)/,"$1.$2"):n.length<=8?n.replace(/(\d{2})(\d{3})(\d)/,"$1.$2.$3"):n.length<=12?n.replace(/(\d{2})(\d{3})(\d{3})(\d)/,"$1.$2.$3/$4"):n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d)/,"$1.$2.$3/$4-$5");s("cnpjEmpresaOutro")(m);}} placeholder="00.000.000/0000-00"/></div>}
      </Field></div>
      {!transportadoraFixa&&f.transportadora==="Outro"&&<div style={{marginBottom:12}}><Field label="Nome da Transportadora" req><Inp value={f.transportadoraOutro||""} onChange={s("transportadoraOutro")} placeholder="Digite o nome..."/></Field></div>}
      <Field label="Número da Fatura" req><Inp value={f.numeroFatura} onChange={s("numeroFatura")} placeholder="Ex: NF-2025-004821"/></Field>
    </Sec>
    <Sec num="2" iconName="pin" title="Origem"><Field label="CD de Origem" req><Sel value={f.cdOrigem} onChange={s("cdOrigem")} options={CDs} placeholder="Selecione o CD..."/></Field></Sec>
    <Sec num="3" iconName="shuffle" title="Segmentação"><Field label="Canal" req><Tgl value={f.segmentacao} onChange={s("segmentacao")} options={["B2B","B2C","Inbound","Fábrica"]}/></Field></Sec>
    <Sec num="4" iconName="calendar" title="Período de Referência">
      <div className="g2" style={{marginBottom:12}}>
        <Field label="Mês" req><Sel value={f.mes} onChange={s("mes")} options={meses} placeholder="Mês..."/></Field>
        <Field label="Ano" req><Sel value={f.ano} onChange={s("ano")} options={anos} placeholder="Ano..."/></Field>
      </div>
      <Field label="Ciclo" req>{ciclosDisponiveis.length===1?<div style={{padding:"9px 11px",background:"var(--s3)",border:"1px solid var(--bd)",borderRadius:6,fontSize:14,color:"var(--text)",fontWeight:600,display:"flex",alignItems:"center",gap:8}}><Icon name="lock" size={13} color="var(--amber)"/>{ciclosDisponiveis[0]}</div>:<Tgl value={f.ciclo} onChange={s("ciclo")} options={ciclosDisponiveis}/>}</Field>
    </Sec>
    <Sec num="5" iconName="dollar" title="Dados Financeiros">
      <div className="g3" style={{marginBottom:12}}>
        <Field label="Natureza" req><Sel value={f.natureza} onChange={v=>{s("natureza")(v);s("naturezaOutro")("");}} options={["Frete","Difal","Transferência de Material","Outro"]} placeholder="Tipo..."/></Field>
        {f.natureza==="Outro"&&<Field label="Descreva a natureza" req><Inp value={f.naturezaOutro||""} onChange={s("naturezaOutro")} placeholder="Ex: Armazenagem..."/></Field>}
        <Field label="Vencimento" req><Inp type="date" value={f.vencimento} onChange={s("vencimento")}/></Field>
        {f.vencimento&&analiseVencimento&&(()=>{
          const alertas=[];
          if(!analiseVencimento.viavel){alertas.push(
            <div key="pgto" style={{padding:"10px 12px",background:"var(--yellow-g)",border:"1px solid var(--yellow-b)",borderRadius:6,fontSize:12,color:"var(--yellow)"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,fontWeight:700}}><Icon name="alert" size={13} color="var(--yellow)"/>Pagamento fora do prazo!</div>
              <div style={{color:"var(--muted)",lineHeight:1.6}}>
                {analiseVencimento.vencimentoAbaixoContrato&&PRAZO_PAGAMENTO[nomeTranspAtual]&&!analiseVencimento.srLogCheck?.abaixoDoAcordado?<>Vencimento abaixo do prazo contratual de <strong style={{color:"var(--yellow)"}}>{analiseVencimento.prazoContratual} dias</strong>.<br/></>:null}
                Próximo pagamento possível: <strong style={{color:"var(--yellow)"}}>{analiseVencimento.dataPagamentoStr}</strong>.<br/>
                <span style={{fontSize:11}}>A fatura será registrada com aviso para contato com a transportadora.</span>
              </div>
            </div>
          );}
          if(analiseVencimento.srLogCheck&&analiseVencimento.srLogCheck.abaixoDoAcordado){alertas.push(
            <div key="srlog" style={{padding:"10px 12px",background:"var(--orange-g)",border:"1px solid var(--orange-b)",borderRadius:6,fontSize:12,color:"var(--orange)"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,fontWeight:700}}><Icon name="alert" size={13} color="var(--orange)"/>SR Log — vencimento incorreto</div>
              <div style={{color:"var(--muted)",lineHeight:1.6}}>Para <strong style={{color:"var(--orange)"}}>{analiseVencimento.srLogCheck.ciclo}</strong>, o vencimento contratual é <strong style={{color:"var(--orange)"}}>{analiseVencimento.srLogCheck.dataEsperadaStr}</strong> ({analiseVencimento.srLogCheck.descEsperado}).</div>
            </div>
          );}
          return alertas.length>0?<>{alertas}</>:null;
        })()}
        <Field label="Valor Bruto" req><Inp value={f.valorBruto} onChange={v=>s("valorBruto")(fmtCur(v))} placeholder="0,00" prefix="R$"/></Field>
      </div>
      <div className="disc-box">
        <Field label="Possui desconto?" req><Tgl value={f.possuiDesconto} onChange={s("possuiDesconto")} options={["Sim","Não"]}/></Field>
        {f.possuiDesconto==="Sim"&&<div className="disc-fields"><div className="g2"><Field label="Valor do Desconto" req><Inp value={f.valorDesconto} onChange={v=>s("valorDesconto")(fmtCur(v))} placeholder="0,00" prefix="R$"/></Field><Field label="Motivo" req><Sel value={f.motivoDesconto} onChange={v=>{s("motivoDesconto")(v);s("motivoOutro")("");}} options={motivosDesc} placeholder="Selecione..."/></Field></div>{f.motivoDesconto==="Outro"&&<div style={{marginTop:8}}><Field label="Descreva" req><Inp value={f.motivoOutro||""} onChange={s("motivoOutro")} placeholder="Descreva o motivo..."/></Field></div>}</div>}
      </div>
    </Sec>
    <Sec num="6" iconName="paperclip" title="Documentos">
      <Field label="Anexar arquivos" req><Dropzone files={f.files} onChange={s("files")}/></Field>
      {f.files.length>0&&(()=>{const mb=f.files.reduce((s,file)=>s+file.size,0)/1048576;if(mb>25)return<div style={{marginTop:8,padding:"8px 12px",background:mb>35?"var(--red-g)":"var(--yellow-g)",border:`1px solid ${mb>35?"var(--red-b)":"var(--yellow-b)"}`,borderRadius:6,fontSize:12,color:mb>35?"var(--red)":"var(--yellow)",display:"flex",alignItems:"center",gap:7}}><Icon name="alert" size={13} color={mb>35?"var(--red)":"var(--yellow)"}/>{mb>35?`Limite excedido (${mb.toFixed(1)} MB). Máximo: 35 MB. Remova arquivos.`:`Atenção: total de ${mb.toFixed(1)} MB. Limite: 35 MB.`}</div>;return null;})()}
    </Sec>
    <div className="card">
      <Preview d={f}/>
      <div className="sub-area">
        <div className={`sub-status${valid()?" ok":""}`}>{valid()?<><Icon name="check" size={13} color="var(--green)"/>Pronto para enviar</>:"Preencha todos os campos obrigatórios (*)"}</div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn-clear" onClick={()=>{if(window.confirm("Limpar tudo?"))resetForm();}}><Icon name="trash" size={13}/>Limpar</button>
          <button className={`btn${valid()?" on":" off"}`} onClick={submit} disabled={!valid()||loading}>{loading?"Enviando...":(<>Registrar Fatura <Icon name="arrowRight" size={13} color="var(--dark)"/></>)}</button>
        </div>
      </div>
    </div>
    <div className="footer">Portal Interno · Google Drive Corporativo</div>
  </div>;
}

// ─── GESTÃO ───────────────────────────────────────────────────────────────────

function Gestao({faturas:faturasLocais, feriados=[]}){
  const [faturas,setFaturas]=useState(faturasLocais);
  const [carregando,setCarregando]=useState(true);
  const [erroCarregar,setErroCarregar]=useState(false);
  const [subAba,setSubAba]=useState("resumo");
  const [busca,setBusca]=useState("");
  const [filtroTransp,setFiltroTransp]=useState("");
  const [filtroEmp,setFiltroEmp]=useState("");
  const [filtroMes,setFiltroMes]=useState("");
  const [filtroAno,setFiltroAno]=useState("");
  const [filtroStatus,setFiltroStatus]=useState("");
  const [filtroNatureza,setFiltroNatureza]=useState("");
  const [rTransp,setRTransp]=useState("");
  const [rEmp,setREmp]=useState("");
  const [rMes,setRMes]=useState("");
  const [rAno,setRAno]=useState("");
  const [rNatureza,setRNatureza]=useState("");
  const [rStatus,setRStatus]=useState("");
  const [rBusca,setRBusca]=useState("");
  const [selecionadas,setSelecionadas]=useState(new Set());
  const [marcando,setMarcando]=useState(false);
  const [pagandoId,setPagandoId]=useState(null);
  const [dataPgtoInput,setDataPgtoInput]=useState("");
  const [ajustandoId,setAjustandoId]=useState(null);
  const [novaDataVenc,setNovaDataVenc]=useState("");
  const [historicoData,setHistoricoData]=useState("");

  useEffect(()=>{
    const carregar=async()=>{
      try{
        setCarregando(true);
        const res=await fetch(APPS_SCRIPT_URL);
        const data=await res.json();
        if(data.sucesso&&data.faturas?.length>0) setFaturas(data.faturas);
      }catch{ setErroCarregar(true); }
      finally{ setCarregando(false); }
    };
    carregar();
  },[]);

  const todasFaturas=useMemo(()=>{
    if(faturas.length===0) return faturasLocais.map((f,i)=>({...f,_key:`l-${i}`}));
    const protos=new Set(faturas.map(f=>f.protocolo).filter(Boolean));
    const novas=faturasLocais.filter(f=>f.protocolo&&!protos.has(f.protocolo));
    return[...faturas,...novas].map((f,i)=>({...f,_key:`f-${i}-${f.protocolo||f.id}`}));
  },[faturas,faturasLocais]);

  const transportadorasUnicas=useMemo(()=>[...new Set(todasFaturas.map(f=>f.transportadora).filter(Boolean))].sort(),[todasFaturas]);
  const empresasUnicas=useMemo(()=>[...new Set(todasFaturas.map(f=>f.empresa).filter(Boolean))].sort(),[todasFaturas]);
  const anosUnicos=useMemo(()=>[...new Set(todasFaturas.map(f=>getAno(f)).filter(Boolean))].sort().reverse(),[todasFaturas]);
  const naturezasUnicas=useMemo(()=>{const base=["Frete","Difal","Transferência de Material"];const extras=[...new Set(todasFaturas.map(f=>f.natureza).filter(n=>n&&!base.includes(n)))].sort();return[...base,...extras];},[todasFaturas]);

  const faturasVisiveis=useMemo(()=>todasFaturas.filter(f=>{
    try{
      const paga=isPaga(f);
      const dc=diasAteVencer(f.vencimento);
      const du=diasUteisAteVencer(f.vencimento,feriados);
      const st=(f.status||"pendente").toLowerCase();
      const emContest=["contestada","auditada","retorno_aceito_total","retorno_aceito_parcial","retorno_recusado"].includes(st);
      const agPgto=["solicitada","aguardando_aprovacao","aguardando_pagamento"].includes(st);
      if(filtroStatus==="Vencido"&&(paga||dc>=0)) return false;
      if(filtroStatus==="Urgente"&&(paga||dc<0||du>6)) return false;
      if(filtroStatus==="A vencer"&&(paga||dc<0||du<=6)) return false;
      if(filtroStatus==="Em contestação"&&!emContest) return false;
      if(filtroStatus==="Ag. Pagamento"&&!agPgto) return false;
      if(filtroStatus==="Paga"&&!paga) return false;
      if(filtroTransp&&(f.transportadora||"")!==filtroTransp) return false;
      if(filtroEmp&&(f.empresa||"")!==filtroEmp) return false;
      if(filtroNatureza&&(f.natureza||"")!==filtroNatureza) return false;
      if(filtroMes&&getMes(f)!==filtroMes) return false;
      if(filtroAno&&getAno(f)!==filtroAno) return false;
      if(busca){const q=busca.toLowerCase();if(![f.transportadora,f.empresa,f.numeroFatura,f.cd,f.seg].some(v=>(v||"").toLowerCase().includes(q)))return false;}
      return true;
    }catch{return true;}
  }),[todasFaturas,filtroStatus,filtroTransp,filtroEmp,filtroMes,filtroAno,busca,feriados]);

  const faturasResumo=useMemo(()=>todasFaturas.filter(f=>{
    try{
      const paga=isPaga(f);
      const dc=diasAteVencer(f.vencimento);
      const du=diasUteisAteVencer(f.vencimento,feriados);
      const st=(f.status||"pendente").toLowerCase();
      const emContest=["contestada","auditada","retorno_aceito_total","retorno_aceito_parcial","retorno_recusado"].includes(st);
      const agPgto=["solicitada","aguardando_aprovacao","aguardando_pagamento"].includes(st);
      if(rStatus==="Vencido"&&(paga||dc>=0)) return false;
      if(rStatus==="Urgente"&&(paga||dc<0||du>6)) return false;
      if(rStatus==="A vencer"&&(paga||dc<0||du<=6)) return false;
      if(rStatus==="Em contestação"&&!emContest) return false;
      if(rStatus==="Ag. Pagamento"&&!agPgto) return false;
      if(rStatus==="Paga"&&!paga) return false;
      if(rTransp&&(f.transportadora||"")!==rTransp) return false;
      if(rEmp&&(f.empresa||"")!==rEmp) return false;
      if(rNatureza&&(f.natureza||"")!==rNatureza) return false;
      if(rMes&&getMes(f)!==rMes) return false;
      if(rAno&&getAno(f)!==rAno) return false;
      if(rBusca){const q=rBusca.toLowerCase();if(![f.transportadora,f.empresa,f.numeroFatura].some(v=>(v||"").toLowerCase().includes(q)))return false;}
      return true;
    }catch{return true;}
  }),[todasFaturas,rTransp,rEmp,rNatureza,rMes,rAno,rStatus,rBusca,feriados]);

  const porTranspResumo=useMemo(()=>{
    const m={};
    faturasResumo.forEach(f=>{m[f.transportadora||"—"]=(m[f.transportadora||"—"]||0)+(f.valor||0);});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[faturasResumo]);
  const maxTransp=porTranspResumo[0]?.[1]||1;

  const marcarPagas=async(protocolos,dataPagamento)=>{
    setMarcando(true);
    try{
      const dt=dataPagamento||new Date().toLocaleDateString("pt-BR");
      await fetch(APPS_SCRIPT_URL,{method:"POST",mode:"no-cors",body:JSON.stringify({acao:"marcarPago",protocolos:[...protocolos],dataPagamento:dt})});
      setFaturas(prev=>prev.map(f=>protocolos.has(f.protocolo)?{...f,status:"paga",dataPagamento:dt}:f));
      setSelecionadas(new Set());setPagandoId(null);setDataPgtoInput("");
    }catch(e){alert("Erro: "+e.message);}
    finally{setMarcando(false);}
  };

  const registrarAjuste=async(protocolo,novoVencimento)=>{
    try{
      const[y,m,d]=novoVencimento.split("-");
      await fetch(APPS_SCRIPT_URL,{method:"POST",mode:"no-cors",body:JSON.stringify({acao:"ajustarVencimento",protocolo,novoVencimento:`${d}/${m}/${y}`,novoAviso:""})});
      setFaturas(prev=>prev.map(f=>f.protocolo===protocolo?{...f,vencimento:novoVencimento}:f));
      setAjustandoId(null);setNovaDataVenc("");
    }catch(e){alert("Erro: "+e.message);}
  };

  const recarregar=async()=>{
    setCarregando(true);
    try{const r=await fetch(APPS_SCRIPT_URL);const d=await r.json();if(d.sucesso&&d.faturas?.length>0)setFaturas(d.faturas);}
    catch{setErroCarregar(true);}
    finally{setCarregando(false);}
  };

  const temFiltro=busca||filtroTransp||filtroEmp||filtroMes||filtroAno||filtroStatus;
  const temFiltroResumo=rBusca||rTransp||rEmp||rNatureza||rMes||rAno||rStatus;

  return<div className="page">
    {carregando&&<div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:13,color:"var(--muted)",display:"flex",alignItems:"center",gap:8}}><span style={{display:"inline-block",width:14,height:14,border:"2px solid var(--amber)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>Carregando faturas...</div>}
    {!carregando&&erroCarregar&&<div style={{background:"var(--yellow-g)",border:"1px solid var(--yellow-b)",borderRadius:8,padding:"12px 16px",marginBottom:14,fontSize:13,color:"var(--yellow)",display:"flex",alignItems:"center",gap:8}}><Icon name="alert" size={14} color="var(--yellow)"/>Não foi possível carregar dados atualizados.</div>}
    {!carregando&&!erroCarregar&&<div style={{fontSize:11,color:"var(--muted)",marginBottom:14,display:"flex",alignItems:"center",gap:6}}><Icon name="check" size={12} color="var(--green)"/>{todasFaturas.length} fatura{todasFaturas.length!==1?"s":""}<button onClick={recarregar} style={{marginLeft:8,background:"none",border:"1px solid var(--bd)",borderRadius:4,padding:"2px 8px",fontSize:11,color:"var(--muted)",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>Atualizar</button></div>}

    <div className="sub-tabs">
      {[["resumo","chart","Resumo"],["faturas","table","Faturas"],["historico","clock","Histórico"]].map(([k,ico,l])=>(
        <button key={k} className={`sub-tab${subAba===k?" on":""}`} onClick={()=>setSubAba(k)}><Icon name={ico} size={13}/>{l}</button>
      ))}
    </div>

    {subAba==="resumo"&&<>
      <div className="filters" style={{marginBottom:16}}>
        <div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.4}}><Icon name="search" size={13}/></span><input className="filter-inp" style={{paddingLeft:28,minWidth:180}} placeholder="Buscar..." value={rBusca} onChange={e=>setRBusca(e.target.value)}/></div>
        <select className="filter-inp" value={rMes} onChange={e=>setRMes(e.target.value)}><option value="">Todos os meses</option>{meses.map(m=><option key={m}>{m}</option>)}</select>
        <select className="filter-inp" value={rAno} onChange={e=>setRAno(e.target.value)}><option value="">Todos os anos</option>{anosUnicos.map(a=><option key={a}>{a}</option>)}</select>
        <select className="filter-inp" value={rTransp} onChange={e=>setRTransp(e.target.value)}><option value="">Todas as transportadoras</option>{transportadorasUnicas.map(t=><option key={t}>{t}</option>)}</select>
        <select className="filter-inp" value={rEmp} onChange={e=>setREmp(e.target.value)}><option value="">Todas as empresas</option>{empresasUnicas.map(e=><option key={e}>{e}</option>)}</select>
        <select className="filter-inp" value={rNatureza} onChange={e=>setRNatureza(e.target.value)}><option value="">Todas as naturezas</option>{naturezasUnicas.map(n=><option key={n}>{n}</option>)}</select>
        <select className="filter-inp" value={rStatus} onChange={e=>setRStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option>Vencido</option><option>Urgente</option><option>A vencer</option>
          <option>Em contestação</option><option>Ag. Pagamento</option><option>Paga</option>
        </select>
        {temFiltroResumo&&<button className="filter-clear" onClick={()=>{setRBusca("");setRTransp("");setREmp("");setRNatureza("");setRMes("");setRAno("");setRStatus("");}}>Limpar</button>}
        <span className="results-count">{faturasResumo.length} resultado{faturasResumo.length!==1?"s":""}</span>
      </div>
      <div className="kpi-grid">
        <div className="kpi k-amber"><div className="kpi-header"><div className="kpi-label">Total Bruto</div><div className="kpi-icon"><Icon name="dollar" size={18}/></div></div><div className="kpi-value">{fmtBRL(faturasResumo.reduce((s,f)=>s+(f.valor||0),0))}</div><div className="kpi-sub">{faturasResumo.length} faturas</div></div>
        <div className="kpi k-blue"><div className="kpi-header"><div className="kpi-label">Total Descontos</div><div className="kpi-icon"><Icon name="dollar" size={18}/></div></div><div className="kpi-value">{fmtBRL(faturasResumo.reduce((s,f)=>s+(f.desconto||0),0))}</div><div className="kpi-sub">{faturasResumo.filter(f=>f.desconto>0).length} com desconto</div></div>
        <div className="kpi k-green"><div className="kpi-header"><div className="kpi-label">Total Líquido</div><div className="kpi-icon"><Icon name="dollar" size={18}/></div></div><div className="kpi-value">{fmtBRL(faturasResumo.reduce((s,f)=>s+(f.valor||0)-(f.desconto||0),0))}</div><div className="kpi-sub">bruto menos descontos</div></div>
        <div className="kpi k-red"><div className="kpi-header"><div className="kpi-label">Vencido (aberto)</div><div className="kpi-icon"><Icon name="alert" size={18}/></div></div><div className="kpi-value">{fmtBRL(faturasResumo.filter(f=>!isPaga(f)&&f.vencimento&&diasAteVencer(f.vencimento)<0).reduce((s,f)=>s+(f.valor-(f.desconto||0)),0))}</div><div className="kpi-sub">{faturasResumo.filter(f=>!isPaga(f)&&f.vencimento&&diasAteVencer(f.vencimento)<0).length} faturas</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div className="kpi k-blue"><div className="kpi-header"><div className="kpi-label">Em Aberto (não pagas)</div><div className="kpi-icon"><Icon name="clock" size={18}/></div></div><div className="kpi-value">{faturasResumo.filter(f=>!isPaga(f)).length}</div><div className="kpi-sub">{fmtBRL(faturasResumo.filter(f=>!isPaga(f)).reduce((s,f)=>s+(f.valor||0),0))}</div></div>
        <div className="kpi k-green"><div className="kpi-header"><div className="kpi-label">Pagas</div><div className="kpi-icon"><Icon name="check" size={18}/></div></div><div className="kpi-value">{faturasResumo.filter(f=>isPaga(f)).length}</div><div className="kpi-sub">{fmtBRL(faturasResumo.filter(f=>isPaga(f)).reduce((s,f)=>s+(f.valor||0),0))}</div></div>
      </div>
      {(()=>{
        const venc=faturasResumo.filter(f=>!isPaga(f)&&f.vencimento&&diasAteVencer(f.vencimento)<0);
        const urg=faturasResumo.filter(f=>{if(isPaga(f)||!f.vencimento)return false;const dc=diasAteVencer(f.vencimento),du=diasUteisAteVencer(f.vencimento,feriados);return dc>=0&&du<=6;});
        return<div className="g2" style={{marginBottom:14}}>
          <div style={{background:"var(--red-g)",border:"1px solid var(--red-b)",borderRadius:8,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Icon name="alert" size={15} color="var(--red)"/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,color:"var(--red)",letterSpacing:"0.04em",textTransform:"uppercase"}}>Vencidas em aberto ({venc.length})</span></div>
            {venc.length===0?<div style={{fontSize:12,color:"var(--muted)"}}>Nenhuma fatura vencida 🎉</div>:<div style={{display:"flex",flexDirection:"column",gap:5}}>{venc.map(f=><div key={f._key||f.id} style={{fontSize:12,display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,color:"var(--text)"}}>{f.transportadora}</span><span style={{color:"var(--muted)"}}>{fmtBRL(f.valor)} · {fmtDate(f.vencimento)}</span></div>)}</div>}
          </div>
          <div style={{background:"var(--yellow-g)",border:"1px solid var(--yellow-b)",borderRadius:8,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Icon name="clock" size={15} color="var(--yellow)"/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,color:"var(--yellow)",letterSpacing:"0.04em",textTransform:"uppercase"}}>Urgente — até 6 dias úteis ({urg.length})</span></div>
            {urg.length===0?<div style={{fontSize:12,color:"var(--muted)"}}>Nenhuma fatura urgente</div>:<div style={{display:"flex",flexDirection:"column",gap:5}}>{urg.map(f=><div key={f._key||f.id} style={{fontSize:12,display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,color:"var(--text)"}}>{f.transportadora}</span><span style={{color:"var(--muted)"}}>{fmtBRL(f.valor)} · {fmtDate(f.vencimento)} · <span style={{color:"var(--yellow)"}}>{diasUteisAteVencer(f.vencimento,feriados)}du</span></span></div>)}</div>}
          </div>
        </div>;
      })()}
      <div className="card-plain">
        <div className="sec-head" style={{marginBottom:16}}><div className="sec-title">Valor por Transportadora</div></div>
        <div className="bar-chart">{porTranspResumo.map(([nome,val])=><div className="bar-row" key={nome}><div className="bar-label">{nome}</div><div className="bar-track"><div className="bar-fill" style={{width:`${(val/maxTransp)*100}%`}}/></div><div className="bar-amt">{fmtBRL(val)}</div></div>)}</div>
        {porTranspResumo.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:13,padding:16}}>Nenhum resultado</div>}
      </div>
    </>}

    {subAba==="faturas"&&<>
      <div className="filters">
        <div style={{position:"relative"}}><span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.4}}><Icon name="search" size={13}/></span><input className="filter-inp" style={{paddingLeft:28,minWidth:200}} placeholder="Nº fatura, transportadora..." value={busca} onChange={e=>setBusca(e.target.value)}/></div>
        <select className="filter-inp" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}><option value="">Todos os meses</option>{meses.map(m=><option key={m}>{m}</option>)}</select>
        <select className="filter-inp" value={filtroAno} onChange={e=>setFiltroAno(e.target.value)}><option value="">Todos os anos</option>{anosUnicos.map(a=><option key={a}>{a}</option>)}</select>
        <select className="filter-inp" value={filtroTransp} onChange={e=>setFiltroTransp(e.target.value)}><option value="">Todas as transportadoras</option>{transportadorasUnicas.map(t=><option key={t}>{t}</option>)}</select>
        <select className="filter-inp" value={filtroEmp} onChange={e=>setFiltroEmp(e.target.value)}><option value="">Todas as empresas</option>{empresasUnicas.map(e=><option key={e}>{e}</option>)}</select>
        <select className="filter-inp" value={filtroNatureza} onChange={e=>setFiltroNatureza(e.target.value)}><option value="">Todas as naturezas</option>{naturezasUnicas.map(n=><option key={n}>{n}</option>)}</select>
        <select className="filter-inp" value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option>Vencido</option><option>Urgente</option><option>A vencer</option>
          <option>Em contestação</option><option>Ag. Pagamento</option><option>Paga</option>
        </select>
        {temFiltro&&<button className="filter-clear" onClick={()=>{setBusca("");setFiltroTransp("");setFiltroEmp("");setFiltroNatureza("");setFiltroMes("");setFiltroAno("");setFiltroStatus("");}}>Limpar</button>}
        <span className="results-count">{faturasVisiveis.length} resultado{faturasVisiveis.length!==1?"s":""}</span>
      </div>

      {selecionadas.size>0&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"var(--amber-glow)",border:"1px solid var(--amber-b)",borderRadius:8,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:"var(--amber)"}}>{selecionadas.size} selecionada{selecionadas.size!==1?"s":""}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:"var(--muted)"}}>Data de pagamento:</span><input type="date" value={dataPgtoInput} onChange={e=>setDataPgtoInput(e.target.value)} style={{padding:"4px 8px",background:"var(--s2)",border:"1px solid var(--amber-b)",borderRadius:5,color:"var(--text)",fontSize:13,outline:"none"}}/></div>
        <button disabled={!dataPgtoInput||marcando} onClick={()=>{if(!dataPgtoInput)return;const[y,m,d]=dataPgtoInput.split("-");marcarPagas(selecionadas,`${d}/${m}/${y}`);}} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"6px 16px",background:dataPgtoInput?"var(--amber)":"var(--s3)",color:dataPgtoInput?"var(--dark)":"var(--dim)",border:"none",borderRadius:5,cursor:dataPgtoInput?"pointer":"not-allowed"}}>{marcando?"Salvando...":"✓ Marcar como Pagas"}</button>
        <button onClick={()=>{setSelecionadas(new Set());setDataPgtoInput("");}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:18}}>×</button>
      </div>}

      <div className="tbl-wrap"><table className="tbl">
        <thead><tr>
          <th style={{width:32}}><input type="checkbox" style={{cursor:"pointer",accentColor:"var(--amber)"}} checked={selecionadas.size===faturasVisiveis.filter(f=>!isPaga(f)).length&&faturasVisiveis.filter(f=>!isPaga(f)).length>0} onChange={e=>{if(e.target.checked)setSelecionadas(new Set(faturasVisiveis.filter(f=>!isPaga(f)&&f.protocolo).map(f=>f.protocolo)));else setSelecionadas(new Set());}}/></th>
          <th>Nº Fatura</th><th>Transportadora</th><th>Empresa</th><th>Referência</th>
          <th>Vencimento</th><th>Valor</th><th>Líquido</th><th>Status</th><th>Situação</th><th>Ações</th>
        </tr></thead>
        <tbody>
          {faturasVisiveis.length===0&&<tr><td colSpan={11} style={{textAlign:"center",color:"var(--muted)",padding:28}}>Nenhuma fatura encontrada</td></tr>}
          {faturasVisiveis.map(f=>{
            const paga=isPaga(f);
            const sel=f.protocolo&&selecionadas.has(f.protocolo);
            const stInfo=getStatusTransp(f);
            return<tr key={f._key||f.id} style={{opacity:paga?0.7:1,background:sel?"rgba(245,166,35,0.05)":""}}>
              <td>{!paga&&f.protocolo&&<input type="checkbox" style={{cursor:"pointer",accentColor:"var(--amber)"}} checked={!!sel} onChange={e=>{const n=new Set(selecionadas);e.target.checked?n.add(f.protocolo):n.delete(f.protocolo);setSelecionadas(n);}}/>}</td>
              <td style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"var(--muted)"}}>{f.numeroFatura||"—"}</td>
              <td><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{f.transportadora}</span></td>
              <td style={{color:"var(--muted)",fontSize:12}}>{f.empresa}</td>
              <td style={{fontSize:12,color:"var(--muted)"}}>{getMes(f)}/{getAno(f)}</td>
              <td style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{fmtDate(f.vencimento)}</td>
              <td style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"var(--amber)"}}>{fmtBRL(f.valor)}</td>
              <td style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"var(--green)"}}>{fmtBRL((f.valor||0)-(f.desconto||0))}</td>
              <td><span className={`badge ${stInfo.badge}`}>{stInfo.label}</span></td>
              <td><StatusBadge f={f} feriados={feriados}/></td>
              <td>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {!paga&&f.protocolo&&(ajustandoId===f.protocolo?
                    <div style={{display:"flex",gap:4}}><input type="date" autoFocus value={novaDataVenc} onChange={e=>setNovaDataVenc(e.target.value)} style={{padding:"3px 7px",background:"var(--s2)",border:"1px solid var(--blue-b)",borderRadius:4,color:"var(--text)",fontSize:12,outline:"none",width:130}}/><button onClick={()=>{if(!novaDataVenc)return;registrarAjuste(f.protocolo,novaDataVenc);}} style={{background:"var(--blue)",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"var(--dark)",fontSize:11,fontWeight:800}}>✓</button><button onClick={()=>{setAjustandoId(null);setNovaDataVenc("");}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:15}}>×</button></div>:
                    <button onClick={()=>{setAjustandoId(f.protocolo);setNovaDataVenc("");}} style={{background:"none",border:"1px solid var(--blue-b)",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:700,color:"var(--blue)"}}>Ajustar</button>
                  )}
                  {!paga&&f.protocolo&&(pagandoId===f.protocolo?
                    <div style={{display:"flex",gap:4}}><input type="date" autoFocus value={dataPgtoInput} onChange={e=>setDataPgtoInput(e.target.value)} style={{padding:"3px 7px",background:"var(--s2)",border:"1px solid var(--amber-b)",borderRadius:4,color:"var(--text)",fontSize:12,outline:"none",width:130}}/><button onClick={()=>{if(!dataPgtoInput)return;const[y,m,d]=dataPgtoInput.split("-");marcarPagas(new Set([f.protocolo]),`${d}/${m}/${y}`);}} style={{background:"var(--green)",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"var(--dark)",fontSize:11,fontWeight:800}}>✓</button><button onClick={()=>{setPagandoId(null);setDataPgtoInput("");}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:15}}>×</button></div>:
                    <button onClick={()=>{setPagandoId(f.protocolo);setDataPgtoInput("");}} style={{background:"none",border:"1px solid var(--green-b)",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:700,color:"var(--green)"}}>Pagar</button>
                  )}
                  {paga&&<span style={{fontSize:11,color:"var(--muted)"}}>{f.dataPagamento?(f.dataPagamento.includes("T")?fmtDate(f.dataPagamento.split("T")[0]):f.dataPagamento):"—"}</span>}
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </>}

    {subAba==="historico"&&<>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:"0.06em",color:"var(--muted)",textTransform:"uppercase"}}>{todasFaturas.length} registro{todasFaturas.length!==1?"s":""}</span>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,color:"var(--muted)"}}>Data de envio:</span>
          <input type="date" value={historicoData} onChange={e=>setHistoricoData(e.target.value)} style={{padding:"5px 9px",background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--text)",fontSize:13,outline:"none"}}/>
          {historicoData&&<button onClick={()=>setHistoricoData("")} style={{background:"none",border:"1px solid var(--bd)",borderRadius:4,padding:"4px 9px",cursor:"pointer",color:"var(--muted)",fontSize:11}}>Limpar</button>}
        </div>
      </div>
      {[...todasFaturas].filter(f=>{
        if(!historicoData)return true;
        try{let de=f.dataEnvio;if(!de)return false;if(de instanceof Date)de=de.toISOString().split("T")[0];if(de.includes("T"))de=de.split("T")[0];if(de.includes("/")){const[d,m,y]=de.split("/");de=`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;}return de===historicoData;}catch{return false;}
      }).reverse().map(f=>{
        const stInfo=getStatusTransp(f);
        return<div className="hist-item" key={f._key||f.id}>
          <div className="hist-icon"><Icon name="file" size={20} color="var(--amber)"/></div>
          <div style={{flex:1,minWidth:0}}>
            <div className="hist-name">{f.transportadora} <span style={{color:"var(--muted)",fontWeight:400,fontSize:12}}>· {f.empresa}</span></div>
            <div className="hist-meta">{f.numeroFatura&&<span style={{color:"var(--amber)",marginRight:6}}>{f.numeroFatura}</span>}{getMes(f)}/{getAno(f)}</div>
          </div>
          <div className="hist-right">
            <div className="hist-val">{fmtBRL(f.valor)}</div>
            <div className="hist-date">Venc. {fmtDate(f.vencimento)}</div>
            <div style={{marginTop:4}}><span className={`badge ${stInfo.badge}`}>{stInfo.label}</span></div>
          </div>
        </div>;
      })}
    </>}
  </div>;
}

// ─── APP ─────────────────────────────────────────────────────────────────────

function AppInner(){
  const [usuario,setUsuario]=useState(lerUsuarioStorage);
  const [aba,setAba]=useState(()=>{const u=lerUsuarioStorage();return u?.role==="gestao"?"gestao":"portal";});
  const [faturas,setFaturas]=useState([]);
  const [feriados,setFeriados]=useState([]);

  useEffect(()=>{
    fetch(APPS_SCRIPT_URL)
      .then(r=>r.json())
      .then(d=>{ if(d.feriados?.length) setFeriados(d.feriados); })
      .catch(()=>{});
  },[]);

  const vencendoBreve=faturas.filter(f=>!isPaga(f)&&f.vencimento&&diasAteVencer(f.vencimento)>=0&&diasUteisAteVencer(f.vencimento,feriados)<=6).length;
  const isGestao=usuario?.role==="gestao";
  const isTransp=usuario?.role==="transportadora";
  const handleLogin=u=>{salvarUsuarioStorage(u);setUsuario(u);setAba(u.role==="gestao"?"gestao":"portal");};
  const handleLogout=()=>{limparUsuarioStorage();setUsuario(null);setAba("portal");};

  if(!usuario)return<><style>{css}</style><LoginInicial onLogin={handleLogin}/></>;
  return<><style>{css}</style>
    <div className="bg-grid" style={{minHeight:"100vh",background:"var(--dark)"}}>
      <div className="topbar"><div className="topbar-inner">
        <div className="topbar-logo"><Icon name="truck" size={22} color="var(--dark)"/></div>
        <div><div className="topbar-badge">Transportes · Financeiro</div><div className="topbar-title">Portal de Faturas</div></div>
        <div className="topbar-right">
          <span className="topbar-user"><div className="topbar-avatar-ph"><Icon name="user" size={13} color="var(--muted)"/></div>{usuario.nome}</span>
          <button className="btn-logout" onClick={handleLogout}><Icon name="logout" size={13}/>Sair</button>
        </div>
      </div></div>
      <div className="stripe"/>
      <div className="tabs-bar"><div className="tabs-inner">
        <button className={`tab${aba==="portal"?" on":""}`} onClick={()=>setAba("portal")}><Icon name="upload" size={13}/>Enviar Fatura</button>
        {isGestao&&<button className={`tab${aba==="gestao"?" on":""}`} onClick={()=>setAba("gestao")}><Icon name="chart" size={13}/>Gestão{vencendoBreve>0&&<span className="tab-dot"/>}</button>}
      </div></div>
      {aba==="portal"&&<PortalEnvio onNovaFatura={f=>setFaturas(p=>[...p,f])} transportadoraFixa={isTransp?usuario.transportadora:null} feriados={feriados}/>}
      {aba==="gestao"&&isGestao&&<Gestao faturas={faturas} feriados={feriados}/>}
    </div>
  </>;
}

export default function App(){return<ErrorBoundary><AppInner/></ErrorBoundary>;}
