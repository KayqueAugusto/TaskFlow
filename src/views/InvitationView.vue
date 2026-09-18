<template><main class="auth-loading"><section class="modal"><div class="modal-head"><div><h2>Convite para workspace</h2><p>Entre no workspace com sua conta pessoal.</p></div></div><p v-if="error" class="login-error">{{error}}</p><div class="modal-actions"><RouterLink to="/dashboard" class="cancel">Voltar</RouterLink><button class="primary-btn" :disabled="loading" @click="accept">{{loading?'Aceitando...':'Aceitar convite'}}</button></div></section></main></template>
<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useWorkspacesStore } from "../stores/workspaces";
const route=useRoute(),router=useRouter(),workspaces=useWorkspacesStore(),loading=ref(false),error=ref("");
async function accept(){loading.value=true;error.value="";try{await workspaces.accept(String(route.params.token));await router.replace("/dashboard")}catch(value){error.value=value instanceof Error?value.message:"Convite indisponível."}finally{loading.value=false}}
</script>
