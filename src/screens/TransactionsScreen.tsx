import React, { useState, useMemo } from 'react';
import { onTabBarScroll } from '../components/FloatingTabBar';
import RhythmDial from '../components/spend/RhythmDial';
import { groupByDay } from '../lib/groupByDay';
import { TypeScale } from '../theme/tokens';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, SectionList } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';
import { Typography } from '../theme/typography';
import { Theme, THEMES } from '../theme/themes';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CAT_COLORS: { [key: string]: string } = {
  Food: '#F59E0B', Groceries: '#84CC16', Shopping: '#8B5CF6', Travel: '#38BDF8',
  Entertainment: '#EF4444', Bills: '#10B981', Health: '#F97316', Other: '#64748B', Income: '#10B981',
  'Personal Care': '#EC4899'
};

const ALL_CATEGORIES = ['Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Bills', 'Health', 'Personal Care', 'Other'];

function createStyles(C: Theme) {
  return StyleSheet.create({
  container: { flex: 1, marginTop: 20 },
  headerTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4, fontFamily: Typography.fontFamilyBold },
  subtleText: { color: C.textSecondary, fontSize: 13, marginBottom: 24, fontFamily: Typography.fontFamilyRegular },

  // Search Bar
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, height: 52
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 15, fontFamily: Typography.fontFamilyRegular },

  // Category Chips
  chipScrollView: { flexGrow: 0, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 10
  },
  chipActive: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.4)' },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  chipTextActive: { color: C.accent, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  // Transaction Card
  txnCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderRadius: 20, padding: 18, marginBottom: 14,
  },

  // Icon Badge (Avatar)
  txnIconBadge: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', fontFamily: Typography.fontFamilyBold },
  txnMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3, fontFamily: Typography.fontFamilyBold },
  txnCategory: { color: C.textSecondary, fontSize: 12, fontFamily: Typography.fontFamilyRegular },
  txnAmount: { fontSize: 15, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  // Day-by-day list (open canvas, hairlines instead of cards)
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 26, paddingBottom: 8 },
  dayTitle: { color: C.textPrimary, fontSize: TypeScale.label, fontFamily: Typography.fontFamilyBold },
  dayTotal: { color: C.textSecondary, fontSize: TypeScale.micro + 1, fontFamily: Typography.fontFamilyMedium },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontFamily: Typography.fontFamilyBold },
  rowMerchant: { color: C.textPrimary, fontSize: TypeScale.body, fontFamily: Typography.fontFamilyBold },
  rowSub: { color: C.textSecondary, fontSize: TypeScale.micro + 1, marginTop: 2, fontFamily: Typography.fontFamilyRegular },
  rowAmount: { fontSize: TypeScale.body, letterSpacing: -0.3, fontFamily: Typography.fontFamilyBold },
  rowTag: { fontSize: TypeScale.micro - 1, marginTop: 2, fontFamily: Typography.fontFamilyBold },
  menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },

  // Action Buttons
  txnActionRow: {
    flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 980, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  actionPillText: { fontSize: 12, fontWeight: '700' },

  // Labeled State
  labeledContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  },
  currentLabelText: { color: C.textSecondary, fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 4 },
  changeText: { color: C.accent, fontSize: 12, fontWeight: '700' },

  // Category Edit Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 24, paddingBottom: 40,
    paddingHorizontal: 24, maxHeight: '70%'
  },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 4, fontFamily: Typography.fontFamilyBold },
  modalSubtitle: { color: '#A0A0B0', fontSize: 14, marginBottom: 24, fontFamily: Typography.fontFamilyRegular },
  catOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 10
  },
  catOptionText: { color: '#FFF', fontSize: 15, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  closeBtn: { alignItems: 'center', marginTop: 16, padding: 10 },
  closeBtnText: { color: '#A0A0B0', fontSize: 14, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  menuOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuOptionText: { color: C.textPrimary, fontSize: 15, fontWeight: '600' }
});
}

interface Props {
  transactions: ParsedTransaction[];
  mode: 'strict' | 'liberal' | null;
  userLabels: UserLabel[];
  labeledTxnIds: string[];
  worthItTxnIds: string[];
  emergencyTxnIds: string[];
  avgAmount: number;
  model: UserBehaviorModel;
  theme: Theme;
  handleLabelTransaction: (txn: ParsedTransaction, isImpulsive: boolean) => void;
  onSetCategory: (txnId: string, category: string) => void;
  handleToggleEmergency: (txnId: string) => void;
}

export default function TransactionsScreen({
    transactions, mode, userLabels, labeledTxnIds, worthItTxnIds, emergencyTxnIds, avgAmount, model, theme, handleLabelTransaction, onSetCategory, handleToggleEmergency
}: Props) {
  const C = theme || THEMES.azure;
  const styles = useMemo(() => createStyles(C), [C]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingTxn, setEditingTxn] = useState<ParsedTransaction | null>(null);
  const [activeMenuTxn, setActiveMenuTxn] = useState<ParsedTransaction | null>(null);

  const categories = ['All', 'Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Bills', 'Health', 'Personal Care', 'Other'];

  const filteredTxns = transactions.filter(t => {
    const matchesSearch = (t.merchant || t.bank).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeFilter === 'All' || t.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  const sections = useMemo(() => groupByDay(filteredTxns), [filteredTxns]);
  const fmtTime = (v: any) => { const d = new Date(v); const h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

  return (
    <View style={{ flex: 1, marginTop: 20 }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id!}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 150 }}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <Text style={styles.headerTitle}>Spend</Text>
            <Text style={styles.subtleText}>{filteredTxns.length} transactions</Text>

            <RhythmDial transactions={transactions} theme={C} />

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Icon name="magnify" size={20} color={C.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search merchants…"
                placeholderTextColor={C.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Category Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView} contentContainerStyle={{ paddingRight: 24 }}>
              {categories.map(cat => (
                <TouchableOpacity key={cat} style={[styles.chip, activeFilter === cat && styles.chipActive]} onPress={() => setActiveFilter(cat)}>
                  <Text style={[styles.chipText, activeFilter === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.subtleText, { marginTop: 24 }]}>No transactions match.</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{section.title}</Text>
            {section.total > 0 ? <Text style={styles.dayTotal}>₹{section.total.toLocaleString('en-IN')} spent</Text> : null}
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const name = item.merchant || item.bank || '?';
          const category = item.category || (item.type === 'credit' ? 'Income' : 'Other');
          const accentColor = item.type === 'credit' ? CAT_COLORS.Income : (CAT_COLORS[category] || CAT_COLORS.Other);
          const isLabeled = labeledTxnIds.includes(item.id!);
          const isWorthIt = worthItTxnIds.includes(item.id!);
          const isEmergency = (emergencyTxnIds || []).includes(item.id!);
          const last = index === section.data.length - 1;

          return (
            <View style={[styles.row, last && { borderBottomWidth: 0 }, isEmergency && { borderLeftWidth: 2, borderLeftColor: C.danger, paddingLeft: 10 }]}>
              <View style={[styles.avatar, { backgroundColor: `${accentColor}1F` }]}>
                <Text style={[styles.avatarTxt, { color: accentColor }]}>{name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.rowMerchant} numberOfLines={1}>{name}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{category} · {fmtTime(item.date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.rowAmount, { color: item.type === 'credit' ? C.success : C.textPrimary }]}>
                  {item.type === 'credit' ? '+' : '−'}₹{Math.round(item.amount).toLocaleString('en-IN')}
                </Text>
                {isLabeled ? (
                  <Text style={[styles.rowTag, { color: isWorthIt ? C.success : C.danger }]}>{isWorthIt ? 'Worth it' : 'Impulse'}</Text>
                ) : null}
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Options for ${name}`} onPress={() => setActiveMenuTxn(item)} style={styles.menuBtn}>
                <Icon name="dots-vertical" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Category Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editingTxn !== null}
        onRequestClose={() => setEditingTxn(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Category</Text>
            <Text style={styles.modalSubtitle}>Classify "{editingTxn?.merchant || editingTxn?.bank}"</Text>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              {ALL_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catOption,
                    editingTxn?.category === cat && { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.4)' }
                  ]}
                  onPress={() => {
                    if (editingTxn) onSetCategory(editingTxn.id!, cat);
                    setEditingTxn(null);
                  }}
                >
                  <Text style={styles.catOptionText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setEditingTxn(null)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action Sheet Modal (Fix #1) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activeMenuTxn !== null}
        onRequestClose={() => setActiveMenuTxn(null)}
      >
        <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActiveMenuTxn(null)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{activeMenuTxn?.merchant || activeMenuTxn?.bank}</Text>
                <Text style={styles.modalSubtitle}>₹{Math.round(activeMenuTxn?.amount || 0).toLocaleString('en-IN')}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveMenuTxn(null)}>
                <Icon name="close" size={24} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              {/* Category Change Shortcut */}
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  const txn = activeMenuTxn;
                  setActiveMenuTxn(null);
                  setTimeout(() => setEditingTxn(txn), 300);
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56,189,248,0.1)' }]}>
                  <Icon name="tag-outline" size={20} color={C.accent} />
                </View>
                <Text style={styles.menuOptionText}>Change Category</Text>
              </TouchableOpacity>

              {/* Emergency Toggle */}
              {activeMenuTxn?.type === 'debit' && (
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    handleToggleEmergency(activeMenuTxn!.id!);
                    setActiveMenuTxn(null);
                  }}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Icon name={emergencyTxnIds.includes(activeMenuTxn.id!) ? "alert-circle" : "alert-circle-outline"} size={20} color={C.danger} />
                  </View>
                  <Text style={[styles.menuOptionText, { color: C.danger }]}>
                    {emergencyTxnIds.includes(activeMenuTxn.id!) ? 'Remove Emergency Flag' : 'Mark as Emergency'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Worth It / Impulsive (Liberal mode only) */}
              {mode === 'liberal' && activeMenuTxn?.type === 'debit' && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.menuOption, { flex: 1 }]}
                    onPress={() => {
                      handleLabelTransaction(activeMenuTxn!, false);
                      setActiveMenuTxn(null);
                    }}
                  >
                    <Icon name="check-circle-outline" size={18} color={C.success} />
                    <Text style={[styles.menuOptionText, { fontSize: 13, color: C.success }]}>Worth It</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuOption, { flex: 1 }]}
                    onPress={() => {
                      handleLabelTransaction(activeMenuTxn!, true);
                      setActiveMenuTxn(null);
                    }}
                  >
                    <Icon name="flash-outline" size={18} color={C.warning} />
                    <Text style={[styles.menuOptionText, { fontSize: 13, color: C.warning }]}>Impulse</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
