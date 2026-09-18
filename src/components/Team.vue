<template><div class="page-view"><div class="welcome-row"><div><p class="eyebrow">GESTÃO</p><h1>Equipe</h1><p class="subcopy">Pessoas que colaboram nos projetos.</p></div><button v-if="canManage" class="primary-btn" @click="$emit('add')"><Plus/>Adicionar membro</button></div><div class="team-grid"><article v-for="m in members" :key="m.id" class="panel person-card" :class="{'blocked-member':m.blocked}"><div class="member-card-top"><Avatar :member="m"/><div v-if="canOpenMenu(m)" class="member-menu-anchor"><button class="member-more" @click.stop="open=open===m.id?null:m.id"><MoreHorizontal/></button><div v-if="open===m.id" class="member-actions-menu"><template v-if="canEdit(m)"><button @click="$emit('edit',m);open=null"><Pencil/>Editar membro</button><button @click="$emit('toggle',m);open=null"><LockOpen v-if="m.blocked"/><Ban v-else/>{{m.blocked?'Desbloquear acesso':'Bloquear acesso'}}</button><button class="danger" @click="$emit('remove',m);open=null"><UserMinus/>Remover do workspace</button></template><button v-if="currentRole==='OWNER'&&m.permissionRole!=='OWNER'&&!m.blocked" @click="$emit('transfer',m);open=null"><UserRoundCog/>Transferir propriedade</button></div></div></div><h3>{{m.name}}</h3><p>{{m.job}} · {{m.permissionRole==='OWNER'?'Proprietário':m.role}}</p><span v-if="m.blocked" class="blocked-badge"><i/>Acesso bloqueado</span><div class="member-card-footer"><span>{{count(m.id)}} tarefa(s) atribuída(s)</span><button class="text-btn" @click="$emit('open',m.id)">Ver atividades →</button></div></article></div></div></template>
<script setup lang="ts">
import{onBeforeUnmount,onMounted,ref}from"vue";
import{Ban,LockOpen,MoreHorizontal,Pencil,Plus,UserMinus,UserRoundCog}from"lucide-vue-next";
import Avatar from"./Avatar.vue";
import type{Member,Task}from"../stores/taskflow";
import type{WorkspaceRole}from"../stores/workspaces";
const props=defineProps<{members:Member[];tasks:Task[];canManage:boolean;currentRole:WorkspaceRole;currentUserId:string}>();
defineEmits(["add","open","edit","toggle","remove","transfer"]);
const open=ref<number|null>(null),count=(id:number)=>props.tasks.filter(t=>t.assigneeId===id).length;
const canEdit=(member:Member)=>props.canManage&&member.membershipId!==props.currentUserId&&member.permissionRole!=="OWNER"&&(props.currentRole==="OWNER"||member.permissionRole==="MEMBER");
const canOpenMenu=(member:Member)=>canEdit(member)||props.currentRole==="OWNER"&&member.permissionRole!=="OWNER"&&!member.blocked;
const close=()=>open.value=null;
const onKey=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape")close()};
onMounted(()=>{document.addEventListener("click",close);document.addEventListener("keydown",onKey)});
onBeforeUnmount(()=>{document.removeEventListener("click",close);document.removeEventListener("keydown",onKey)});
</script>
