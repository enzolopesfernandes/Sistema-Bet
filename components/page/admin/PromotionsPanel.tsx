"use client";
import { useState } from "react";
import type { PromotionView } from "@/lib/gestao";
import OperationForm from "../gestao/OperationForm";
import { localDate } from "./GamesPanel";
import styles from "./admin.module.scss";
export default function PromotionsPanel({ promotions }: { promotions: PromotionView[] }) {
  const [selected, setSelected] = useState<PromotionView | "nova" | null>(null), [remove, setRemove] = useState(false);
  const [notice, setNotice] = useState("");
  const promotion = selected && selected !== "nova" ? selected : null;
  return <>{notice && <p role="status" className={styles.success}>{notice}</p>}<button onClick={() => { setSelected("nova"); setRemove(false); }}>Cadastrar promoção</button>
    {selected && <section className={styles.card}><h2>{remove ? "Remover promoção" : promotion ? "Editar promoção" : "Nova promoção"}</h2><OperationForm key={`${promotion?.id ?? "nova"}:${remove}`} endpoint={`/api/admin/promocoes${promotion ? `/${promotion.id}` : ""}`} method={promotion ? "PATCH" : "POST"} review={remove ? "Remover esta promoção das novas apostas? Os benefícios já contratados serão preservados." : "Confirma as regras e o benefício da promoção?"} onCancel={() => setSelected(null)} onSuccess={body => { setNotice(String(body.message ?? "Operação realizada com sucesso")); setSelected(null); }} payload={f => remove ? { acao: "remover", versao: promotion?.versao } : ({ ...Object.fromEntries(f), versao: promotion?.versao, inicio: new Date(String(f.get("inicio"))).toISOString(), fim: new Date(String(f.get("fim"))).toISOString(), jogoId: f.get("jogoId") ? Number(f.get("jogoId")) : null, limite: f.get("limite") ? Number(f.get("limite")) : null, porUsuario: Number(f.get("porUsuario")) })}>
      {remove ? <p>{promotion?.nome}</p> : <><div className={styles.grid}><label>Nome<input name="nome" defaultValue={promotion?.nome} required maxLength={150} /></label><label>Código (opcional)<input name="codigo" defaultValue={promotion?.codigo ?? ""} maxLength={60} pattern="[A-Za-z0-9_-]+" /></label></div><label>Descrição<textarea name="descricao" defaultValue={promotion?.descricao} required maxLength={500} /></label><div className={styles.grid}>
        <label>Benefício<select name="tipo" defaultValue={promotion?.tipo ?? "BONUS_CREDITO"}><option value="BONUS_CREDITO">Bônus em créditos</option><option value="ODDS_BOOST">Aumento percentual do lucro da odd</option></select></label>
        <label>Créditos de bônus ou percentual (até 100%)<input name="beneficio" type="number" step="0.01" min="0.01" max="10000" defaultValue={promotion?.beneficio ?? "10"} required /></label>
        <label>Aposta mínima em créditos<input name="minimo" type="number" step="0.01" min="0.01" max="10000" defaultValue={promotion?.minimo ?? "10"} required /></label><label>ID do jogo (vazio = todos)<input name="jogoId" type="number" step="1" defaultValue={promotion?.jogoId ?? ""} /></label>
        <label>Início (horário deste computador)<input name="inicio" type="datetime-local" defaultValue={promotion ? localDate(promotion.inicio) : ""} required /></label><label>Fim (horário deste computador)<input name="fim" type="datetime-local" defaultValue={promotion ? localDate(promotion.fim) : ""} required /></label>
        <label>Limite total (vazio = sem limite)<input name="limite" type="number" min={1} max={1000000} defaultValue={promotion?.limite ?? ""} /></label><label>Limite por usuário<input name="porUsuario" type="number" min={1} max={1000000} defaultValue={promotion?.porUsuario ?? 1} required /></label><label>Situação<select name="status" defaultValue={promotion?.status ?? "ATIVA"}><option value="ATIVA">Ativa</option><option value="PAUSADA">Pausada</option><option value="ENCERRADA">Encerrada</option></select></label>
      </div><p className={styles.note}>O bônus é creditado após a confirmação da aposta. O aumento percentual incide sobre a parte da odd acima de 1; por exemplo, odd 2 com 10% passa a 2,10. Cada aposta aceita uma promoção.</p></>}
    </OperationForm></section>}
    {!promotions.length && <p className={styles.empty}>Nenhuma promoção cadastrada no sistema.</p>}
    {promotions.map(p => <article className={styles.card} key={p.id}><h2>{p.nome}</h2><p>{p.descricao}</p><p>{p.tipo === "BONUS_CREDITO" ? `${p.beneficio} créditos de bônus` : `${p.beneficio}% de aumento no lucro da odd`} · Mínimo: {p.minimo} créditos · {p.status}</p><p>{new Date(p.inicio).toLocaleString("pt-BR")} até {new Date(p.fim).toLocaleString("pt-BR")} · {p.porUsuario} uso(s) por pessoa · {p.limite ?? "Sem limite"} no total</p><div className={styles.actions}><button onClick={() => { setSelected(p); setRemove(false); }}>Editar</button><button onClick={() => { setSelected(p); setRemove(true); }}>Remover</button></div></article>)}
  </>;
}
