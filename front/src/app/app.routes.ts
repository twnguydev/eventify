import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import { AuthGuard } from '@guards/auth.guard';
import { NoAuthGuard } from '@guards/no-auth.guard';
import { DeviceTypeGuard } from '@guards/device-type.guard';
import { AppComponent } from './app.component';
import { LoginComponent } from '@pages/auth/login/login.component';
import { CallbackComponent } from '@pages/auth/callback/callback.component';
import { ProfileComponent } from '@pages/profile/profile.component';
import { ErrorComponent } from '@pages/error/error.component';
import { EventCatalogueComponent } from '@pages/event-catalogue/event-catalogue.component';
import { EventCatalogueMobileComponent } from '@pages/event-catalogue-mobile/event-catalogue-mobile.component';
import { CreateEventComponent } from '@pages/event/create-event/create-event.component';
import { EventDetailsComponent } from '@pages/event-details/event-details.component';
import { CreateGroupComponent } from '@pages/event/create-group/create-group.component';
import { GroupDetailsComponent } from '@pages/group-details/group-details.component';
import { LegalMentionsComponent } from '@pages/legal/legal-mentions/legal-mentions.component';
import { CguComponent } from '@pages/legal/cgu/cgu.component';
import { PrivacyPolicyComponent } from '@pages/legal/privacy-policy/privacy-policy.component';
import { DashboardComponent } from '@pages/event/dashboard/dashboard.component';

export const routes: Routes = [
    { path: '', canActivate: [DeviceTypeGuard], pathMatch: 'full', component: LoginComponent },

    { path: 'auth', component: LoginComponent, canActivate: [NoAuthGuard] },
    { path: 'event-list', component: EventCatalogueComponent, canActivate: [AuthGuard] },
    { path: 'm/event-list', component: EventCatalogueMobileComponent, canActivate: [AuthGuard] },
    { path: 'auth/callback/:provider', component: CallbackComponent, canActivate: [NoAuthGuard] },
    { path: 'profile/:id', component: ProfileComponent, canActivate: [AuthGuard] },
    { path: 'organizer/new-event', component: CreateEventComponent, canActivate: [AuthGuard] },
    { path: 'organizer/:slug/dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
    { path: 'event/:slug', component: EventDetailsComponent, canActivate: [AuthGuard] },
    { path: 'event/:slug/organizer/group', component: CreateGroupComponent, canActivate: [AuthGuard] },
    { path: 'event/:slug/group/:groupId', component: GroupDetailsComponent, canActivate: [AuthGuard] },
    { path: 'legal/mentions', component: LegalMentionsComponent },
    { path: 'legal/cgu', component: CguComponent },
    { path: 'legal/privacy', component: PrivacyPolicyComponent},
    { path: '404', component: ErrorComponent },
    { path: '**', component: ErrorComponent },
];

const routerOptions: ExtraOptions = {
    useHash: false,
};

@NgModule({
    imports: [RouterModule.forRoot(routes, routerOptions)],
    exports: [RouterModule]
})

export class AppRoutingModule { }