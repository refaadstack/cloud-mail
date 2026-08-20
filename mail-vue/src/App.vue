<template>
  <router-view />
</template>
<script setup>
import { useI18n } from "vue-i18n";
import { watch } from "vue";
import {useSettingStore} from "@/store/setting.js";
const settingStore = useSettingStore()
import('@/icons/index.js')
const { locale } = useI18n()
locale.value = 'en'
watch(() => settingStore.lang, () => locale.value = 'en')
</script>
