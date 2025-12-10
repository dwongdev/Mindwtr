
import { Drawer } from 'expo-router/drawer';
import { Link } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Search } from 'lucide-react-native';
import { useTheme } from '../../contexts/theme-context';
import { useLanguage } from '../../contexts/language-context';

export default function DrawerLayout() {
    const { isDark } = useTheme();
    const { t } = useLanguage();


    return (
        <Drawer
            screenOptions={{
                drawerActiveTintColor: '#3B82F6',
                drawerInactiveTintColor: '#6B7280',
                headerShown: true,
                drawerStyle: {
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                },
                headerStyle: {
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                },
                headerTintColor: isDark ? '#F9FAFB' : '#111827',
                drawerLabelStyle: {
                    color: isDark ? '#F9FAFB' : '#111827',
                },
                headerRight: () => (
                    <Link href="/global-search" asChild>
                        <TouchableOpacity style={{ marginRight: 16 }}>
                            <Search size={24} color={isDark ? '#F9FAFB' : '#111827'} />
                        </TouchableOpacity>
                    </Link>
                ),
            }}
        >
            <Drawer.Screen
                name="(tabs)"
                options={{
                    drawerLabel: t('nav.main'),
                    title: t('app.name'),
                    headerShown: true,
                }}
            />
            <Drawer.Screen
                name="board"
                options={{
                    drawerLabel: t('nav.board'),
                    title: t('board.title'),
                }}
            />
            <Drawer.Screen
                name="calendar"
                options={{
                    drawerLabel: t('nav.calendar'),
                    title: t('calendar.title'),
                }}
            />
            <Drawer.Screen
                name="contexts"
                options={{
                    drawerLabel: t('nav.contexts'),
                    title: t('contexts.title'),
                }}
            />
            <Drawer.Screen
                name="waiting"
                options={{
                    drawerLabel: t('nav.waiting'),
                    title: t('waiting.title'),
                }}
            />
            <Drawer.Screen
                name="someday"
                options={{
                    drawerLabel: t('nav.someday'),
                    title: t('someday.title'),
                }}
            />

            <Drawer.Screen
                name="projects-screen"
                options={{
                    drawerLabel: t('nav.projects'),
                    title: t('projects.title'),
                }}
            />

            <Drawer.Screen
                name="archived"
                options={{
                    drawerLabel: t('nav.archived') || 'Archived',
                    title: t('archived.title') || 'Archived',
                }}
            />

            <Drawer.Screen
                name="settings"
                options={{
                    drawerLabel: t('nav.settings'),
                    title: t('settings.title'),
                }}
            />
        </Drawer>
    );
}
