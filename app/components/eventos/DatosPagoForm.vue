<script setup lang="ts">
import type { Banco, Billetera, DatosPago } from '~/types/api'

const props = defineProps<{ datos: DatosPago | null, enviando?: boolean }>()
const emit = defineEmits<{ guardar: [datos: DatosPago] }>()

const titular = ref(props.datos?.titular ?? '')
const bancos = ref<Banco[]>(structuredClone(props.datos?.bancos ?? []))
const billeteras = ref<Billetera[]>(structuredClone(props.datos?.billeteras ?? []))

function guardar() {
  emit('guardar', {
    titular: titular.value.trim() || null,
    bancos: bancos.value.filter((b) => b.codigo && b.numeroCuenta).map((b) => ({ ...b, codigo: b.codigo.trim().toLowerCase(), cci: b.cci?.trim() || null })),
    billeteras: billeteras.value.filter((b) => b.codigo && b.telefono).map((b) => ({ ...b, codigo: b.codigo.trim().toLowerCase(), qrUrl: b.qrUrl?.trim() || null })),
  })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="guardar">
    <p class="text-sm text-slate-400">Estos datos se muestran en la landing al momento de pagar la inscripción. Los cambios se reflejan sin redesplegar.</p>
    <AppField label="Titular de las cuentas" for="dp-titular">
      <input id="dp-titular" v-model="titular" class="field-control" maxlength="150">
    </AppField>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">Cuentas bancarias</h3>
        <AppButton size="sm" variant="secondary" icon="heroicons:plus" @click="bancos.push({ codigo: '', nombre: '', numeroCuenta: '', cci: '' })">Agregar cuenta</AppButton>
      </div>
      <div v-for="(banco, indice) in bancos" :key="`b-${indice}`" class="grid gap-3 rounded-xl bg-white/5 p-4 md:grid-cols-[0.8fr_1fr_1.3fr_1.3fr_auto]">
        <AppField label="Código" :for="`b-cod-${indice}`"><input :id="`b-cod-${indice}`" v-model="banco.codigo" class="field-control" placeholder="bcp"></AppField>
        <AppField label="Banco" :for="`b-nom-${indice}`"><input :id="`b-nom-${indice}`" v-model="banco.nombre" class="field-control" placeholder="BCP"></AppField>
        <AppField label="N° de cuenta" :for="`b-cta-${indice}`"><input :id="`b-cta-${indice}`" v-model="banco.numeroCuenta" class="field-control font-mono"></AppField>
        <AppField label="CCI" :for="`b-cci-${indice}`"><input :id="`b-cci-${indice}`" v-model="banco.cci" class="field-control font-mono"></AppField>
        <div class="flex items-end"><AppButton variant="danger" size="sm" icon="heroicons:trash" aria-label="Quitar cuenta" @click="bancos.splice(indice, 1)" /></div>
      </div>
      <p v-if="!bancos.length" class="text-sm text-slate-400">Sin cuentas bancarias.</p>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">Billeteras digitales</h3>
        <AppButton size="sm" variant="secondary" icon="heroicons:plus" @click="billeteras.push({ codigo: '', nombre: '', telefono: '', qrUrl: '' })">Agregar billetera</AppButton>
      </div>
      <div v-for="(billetera, indice) in billeteras" :key="`w-${indice}`" class="grid gap-3 rounded-xl bg-white/5 p-4 md:grid-cols-[0.8fr_1fr_1fr_1.6fr_auto]">
        <AppField label="Código" :for="`w-cod-${indice}`"><input :id="`w-cod-${indice}`" v-model="billetera.codigo" class="field-control" placeholder="yape"></AppField>
        <AppField label="Nombre" :for="`w-nom-${indice}`"><input :id="`w-nom-${indice}`" v-model="billetera.nombre" class="field-control" placeholder="Yape"></AppField>
        <AppField label="Teléfono" :for="`w-tel-${indice}`"><input :id="`w-tel-${indice}`" v-model="billetera.telefono" class="field-control font-mono"></AppField>
        <AppField label="URL del QR" :for="`w-qr-${indice}`"><input :id="`w-qr-${indice}`" v-model="billetera.qrUrl" class="field-control" placeholder="/images/qr/yape-2026.png"></AppField>
        <div class="flex items-end"><AppButton variant="danger" size="sm" icon="heroicons:trash" aria-label="Quitar billetera" @click="billeteras.splice(indice, 1)" /></div>
      </div>
      <p v-if="!billeteras.length" class="text-sm text-slate-400">Sin billeteras.</p>
    </section>

    <div class="flex justify-end">
      <AppButton type="submit" :loading="enviando" icon="heroicons:check">Guardar datos de pago</AppButton>
    </div>
  </form>
</template>
