<template><RouterView v-if="ready" /></template>

<script setup lang="ts">
import { ref } from "vue";import { RouterView } from "vue-router";import { useAuthStore } from "./stores/auth";
const ready=ref(false),auth=useAuthStore();auth.bootstrap().finally(()=>{ready.value=true});
</script>
